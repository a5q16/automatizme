/**
 * @fileoverview Canboso Telegram Seller marketplace API client.
 *
 * Wraps the Canboso public market REST API with retry logic,
 * rate-limit awareness, and structured error handling.
 *
 * Endpoints:
 *   GET  /products          — list / search marketplace products
 *   POST /products/{id}/buy — purchase a product
 *
 * Required env vars:
 *   CANBOSO_API_KEY  - API key for X-API-Key header
 *   CANBOSO_API_BASE - (optional) Base URL override
 *                      Default: https://canboso.com/api/public/market
 */

import {  sleep, isRetryableError, truncate  } from './utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'https://canboso.com/api/public/market';

/** Maximum retries for transient / 5xx errors. */
const MAX_RETRIES = 3;

/** Base delay (ms) for exponential backoff — doubles each attempt. */
const BASE_BACKOFF_MS = 1_000;

/** Per-request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Rate-limit state (module-level singleton)
// ---------------------------------------------------------------------------

/**
 * In-memory tracker for rate-limit headers returned by the API.
 * @type {{ remaining: number|null; resetAt: number|null; lastRequestAt: number|null }}
 */
const rateLimitState = {
  remaining: null,
  resetAt: null,
  lastRequestAt: null,
};

/**
 * In-memory cache for the last known wallet balance (extracted from purchase
 * settlement responses).
 * @type {number|null}
 */
let lastKnownBalance = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the API key from environment variables.
 * @returns {string}
 * @throws {Error} If the key is not configured.
 */
function getApiKey() {
  const key = process.env.CANBOSO_API_KEY;
  if (!key) {
    throw new Error(
      '[Canboso] CANBOSO_API_KEY environment variable is not set.'
    );
  }
  return key;
}

/**
 * Returns the base URL (without trailing slash).
 * @returns {string}
 */
function getBaseUrl() {
  const url = (process.env.CANBOSO_API_BASE || DEFAULT_BASE_URL).replace(
    /\/+$/,
    ''
  );
  return url;
}

/**
 * Updates internal rate-limit state from response headers.
 *
 * The Canboso API may return standard rate-limit headers:
 *   X-RateLimit-Remaining, X-RateLimit-Reset, RateLimit-Remaining, etc.
 *
 * @param {Headers} headers - Fetch API Headers object.
 */
function updateRateLimitState(headers) {
  const remaining =
    headers.get('x-ratelimit-remaining') ??
    headers.get('ratelimit-remaining');
  const reset =
    headers.get('x-ratelimit-reset') ??
    headers.get('ratelimit-reset');

  if (remaining !== null) {
    rateLimitState.remaining = parseInt(remaining, 10);
  }
  if (reset !== null) {
    // reset may be epoch seconds or a date string
    const parsed = Number(reset);
    rateLimitState.resetAt = Number.isFinite(parsed)
      ? parsed * 1000 // assume epoch seconds → ms
      : new Date(reset).getTime();
  }
  rateLimitState.lastRequestAt = Date.now();
}

/**
 * If the rate limit is near exhaustion, waits until the reset window.
 * Called before each request to proactively avoid 429 responses.
 *
 * @returns {Promise<void>}
 */
async function waitForRateLimit() {
  if (
    rateLimitState.remaining !== null &&
    rateLimitState.remaining <= 1 &&
    rateLimitState.resetAt !== null
  ) {
    const waitMs = Math.max(0, rateLimitState.resetAt - Date.now()) + 500; // 500 ms buffer
    if (waitMs > 0 && waitMs < 120_000) {
      console.log(
        `[Canboso] Rate limit nearly exhausted — waiting ${waitMs} ms.`
      );
      await sleep(waitMs);
    }
  }
}

/**
 * Core fetch wrapper with retry logic, timeout, and rate-limit tracking.
 *
 * @param {string} method   - HTTP method.
 * @param {string} path     - API path relative to base URL (leading / required).
 * @param {object} [options]
 * @param {Record<string, string>} [options.query] - URL query params.
 * @param {object} [options.body]                  - JSON request body.
 * @returns {Promise<object>} Parsed JSON response body.
 * @throws {CanbosoApiError} On non-retryable API errors or exhausted retries.
 */
async function canbosoFetch(method, path, options = {}) {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();

  // Build URL with query params
  const url = new URL(`${baseUrl}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Wait if we're close to the rate limit ceiling
    await waitForRateLimit();

    // Exponential backoff (skip on first attempt)
    if (attempt > 0) {
      const delayMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(
        `[Canboso] Retry ${attempt}/${MAX_RETRIES} after ${delayMs} ms...`
      );
      await sleep(delayMs);
    }

    try {
      const fetchOptions = {
        method,
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      };

      if (options.body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url.toString(), fetchOptions);

      // Track rate-limit headers regardless of status
      updateRateLimitState(response.headers);

      // Parse body (try JSON, fall back to text)
      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { rawBody: text };
        }
      }

      // Success
      if (response.ok) {
        return data;
      }

      // Build a structured error
      const apiError = new CanbosoApiError(
        data.message || data.error || `HTTP ${response.status}`,
        response.status,
        data.code || null,
        data
      );

      // 429 — always retry after respecting the rate-limit wait
      if (response.status === 429) {
        lastError = apiError;
        // Force a wait based on reset header if available
        if (rateLimitState.resetAt) {
          const waitMs = Math.max(0, rateLimitState.resetAt - Date.now()) + 1_000;
          if (waitMs > 0 && waitMs < 120_000) {
            await sleep(waitMs);
          }
        } else {
          await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
        }
        continue;
      }

      // Non-retryable client error → throw immediately
      if (!isRetryableError({ status: response.status })) {
        throw apiError;
      }

      // Retryable server error
      lastError = apiError;
    } catch (error) {
      if (error instanceof CanbosoApiError) {
        throw error; // Already a structured non-retryable error
      }

      // Network / timeout errors are retryable
      lastError = error;

      if (!isRetryableError(error) && attempt === 0) {
        // Unknown error type on first attempt — still try once more
        continue;
      }
    }
  }

  // All retries exhausted
  throw lastError instanceof CanbosoApiError
    ? lastError
    : new CanbosoApiError(
        lastError?.message || 'Request failed after retries',
        0,
        'RETRIES_EXHAUSTED',
        { originalError: lastError?.message }
      );
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

/**
 * Structured error for Canboso API failures.
 */
class CanbosoApiError extends Error {
  /**
   * @param {string} message      - Human-readable error message.
   * @param {number} status       - HTTP status code (0 if network error).
   * @param {string|null} code    - API error code (e.g. INSUFFICIENT_BALANCE).
   * @param {object} [data]       - Full API error response body.
   */
  constructor(message, status, code, data) {
    super(message);
    this.name = 'CanbosoApiError';
    this.status = status;
    this.code = code;
    this.data = data || {};
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Valid sort options for the product listing endpoint.
 * @typedef {'price_asc'|'price_desc'|'newest'|'available_desc'|'name_asc'} ProductSort
 */

/**
 * Valid product type filter values.
 * @typedef {'account'|'slot'|'upgrade_account'} SlotProductType
 */

/**
 * @typedef {object} ListProductsOptions
 * @property {number}           [page=1]            - Page number (1-indexed).
 * @property {number}           [limit=50]          - Items per page (max 100).
 * @property {string}           [search]            - Free-text search query.
 * @property {SlotProductType}  [slotProductType]   - Filter by product type.
 * @property {string}           [seller]            - Filter by seller display name.
 * @property {string}           [emoji]             - Filter by emoji tag.
 * @property {ProductSort}      [sort]              - Sort order.
 */

/**
 * @typedef {object} MarketProduct
 * @property {string}  _id
 * @property {string}  productName
 * @property {string}  emoji
 * @property {string}  slotProductType
 * @property {boolean} isSlotProduct
 * @property {number}  marketSalePrice
 * @property {number}  marketMinListingPrice
 * @property {string}  description
 * @property {string}  sellerDisplayName
 * @property {{ total: number; sold: number; available: number }} stats
 * @property {boolean} isMine
 * @property {boolean} alreadyPulled
 * @property {string}  updatedAt
 */

/**
 * Lists products on the Canboso marketplace with optional filtering, sorting,
 * and pagination.
 *
 * @param {ListProductsOptions} [options={}] - Query filters.
 * @returns {Promise<{ products: MarketProduct[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>}
 * @throws {CanbosoApiError} On API errors.
 */
async function listProducts(options = {}) {
  // Clamp limit to API maximum
  const limit = Math.min(Math.max(1, Number(options.limit) || 50), 100);
  const page = Math.max(1, Number(options.page) || 1);

  /** @type {Record<string, string>} */
  const query = {
    page: String(page),
    limit: String(limit),
  };

  if (options.search) query.search = options.search;
  if (options.slotProductType) query.slotProductType = options.slotProductType;
  if (options.seller) query.seller = options.seller;
  if (options.emoji) query.emoji = options.emoji;
  if (options.sort) query.sort = options.sort;

  const data = await canbosoFetch('GET', '/products', { query });

  if (!data || !data.success) {
    throw new CanbosoApiError(
      data?.message || 'Failed to list products',
      0,
      'LIST_FAILED',
      data
    );
  }

  return {
    products: Array.isArray(data.products) ? data.products : [],
    pagination: data.pagination || { page, limit, total: 0, totalPages: 0 },
  };
}

/**
 * @typedef {object} BuyProductOptions
 * @property {number}  quantity - Number of units to purchase (1–50).
 * @property {string}  [email]  - Buyer email (required for slot products).
 */

/**
 * @typedef {object} PurchaseResult
 * @property {boolean} success
 * @property {string}  message
 * @property {string}  productType
 * @property {object}  order
 * @property {string}  order.orderCode
 * @property {string}  order.productName
 * @property {number}  order.quantity
 * @property {number}  order.unitPrice
 * @property {string}  order.customerEmail
 * @property {string}  order.status
 * @property {object}  order.settlement
 * @property {number}  order.settlement.baseAmount
 * @property {number}  order.settlement.feeAmount
 * @property {number}  order.settlement.feeRate
 * @property {number}  order.settlement.totalAmount
 * @property {number}  order.settlement.walletBalanceAfter
 * @property {Array|null} items
 */

/**
 * Purchases a product from the Canboso marketplace.
 *
 * @param {string} productId - The _id of the product to purchase.
 * @param {number} quantity  - Number of units (1–50).
 * @param {string} [email]   - Buyer email (required for slot products).
 * @returns {Promise<PurchaseResult>}
 * @throws {CanbosoApiError} On API errors (INSUFFICIENT_BALANCE, OUT_OF_STOCK, etc.).
 */
async function buyProduct(productId, quantity, email) {
  // Input validation
  if (!productId || typeof productId !== 'string') {
    throw new CanbosoApiError(
      'productId is required and must be a non-empty string.',
      0,
      'INVALID_PRODUCT',
      {}
    );
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
    throw new CanbosoApiError(
      `quantity must be an integer between 1 and 50, got ${quantity}.`,
      0,
      'INVALID_QUANTITY',
      {}
    );
  }

  /** @type {Record<string, any>} */
  const body = { quantity: qty };
  if (email) {
    body.email = String(email);
  }

  const encodedId = encodeURIComponent(productId);
  const data = await canbosoFetch('POST', `/products/${encodedId}/buy`, {
    body,
  });

  if (!data || !data.success) {
    throw new CanbosoApiError(
      data?.message || 'Purchase failed',
      0,
      data?.code || 'PURCHASE_FAILED',
      data
    );
  }

  // Cache the wallet balance for later queries
  if (data.order?.settlement?.walletBalanceAfter != null) {
    lastKnownBalance = data.order.settlement.walletBalanceAfter;
  }

  return data;
}

/**
 * Attempts to retrieve the current wallet balance.
 *
 * The Canboso public API does not expose a dedicated balance endpoint, so
 * this function uses two strategies:
 *
 * 1. Return the last known balance cached from a previous purchase settlement.
 * 2. If no cached balance exists, attempt a "probe" purchase of a very cheap
 *    product with quantity 0 (which will fail with INVALID_QUANTITY but the
 *    error response for INSUFFICIENT_BALANCE includes currentBalance).
 *    Since we can't reliably trigger that, we fall back to null.
 *
 * @returns {Promise<{ balance: number|null; source: 'cache'|'unknown' }>}
 */
async function getWalletBalance() {
  if (lastKnownBalance !== null) {
    return {
      balance: lastKnownBalance,
      source: 'cache',
    };
  }

  // No cached balance — we cannot determine it without a purchase attempt.
  // A future purchase will populate the cache.
  console.log(
    '[Canboso] No cached wallet balance available. ' +
      'Balance will be populated after the next purchase.'
  );

  return {
    balance: null,
    source: 'unknown',
  };
}

/**
 * Returns the current rate-limit state (useful for monitoring dashboards).
 *
 * @returns {{ remaining: number|null; resetAt: number|null; lastRequestAt: number|null }}
 */
function getRateLimitState() {
  return { ...rateLimitState };
}

export {
  listProducts,
  buyProduct,
  getWalletBalance,
  getRateLimitState,
  CanbosoApiError,
};

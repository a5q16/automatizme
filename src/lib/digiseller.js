// @ts-nocheck
/**
 * Digiseller API Client Library
 *
 * Handles authentication (auto-refresh), order fetching, chat messaging,
 * and product management (kill-switch deactivation).
 *
 * Required env vars:
 *   DIGISELLER_SELLER_ID  — integer seller ID
 *   DIGISELLER_API_KEY    — API key string
 *
 * All HTTP calls include:
 *   • 3 retries with exponential back-off for 5xx errors
 *   • Automatic token refresh + single retry on 401
 */

import { createHash } from 'node:crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.digiseller.com';

/** Token is valid for 120 min; we refresh proactively at 110 min. */
const TOKEN_LIFETIME_MS = 120 * 60 * 1000;
const TOKEN_REFRESH_THRESHOLD_MS = 110 * 60 * 1000;

/** Retry configuration for 5xx errors. */
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000; // 1 s → 2 s → 4 s

// ─── Module-level token cache ─────────────────────────────────────────────────

/** @type {string | null} */
let cachedToken = null;

/** @type {number} Unix-ms timestamp when the cached token was obtained. */
let tokenObtainedAt = 0;

/**
 * Guard to ensure only one in-flight auth request at a time.
 * @type {Promise<string> | null}
 */
let tokenRefreshPromise = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Read and validate required environment variables.
 * Throws immediately if anything is missing or malformed.
 *
 * @returns {{ sellerId: number, apiKey: string }}
 */
function getEnvConfig() {
  const rawSellerId = process.env.DIGISELLER_SELLER_ID;
  const apiKey = process.env.DIGISELLER_API_KEY;

  if (!rawSellerId) {
    throw new Error('[Digiseller] Missing env var DIGISELLER_SELLER_ID');
  }
  if (!apiKey) {
    throw new Error('[Digiseller] Missing env var DIGISELLER_API_KEY');
  }

  const sellerId = Number(rawSellerId);
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    throw new Error(
      `[Digiseller] DIGISELLER_SELLER_ID must be a positive integer, got: "${rawSellerId}"`
    );
  }

  return { sellerId, apiKey };
}

/**
 * Build the SHA-256 HMAC-style sign expected by /api/apilogin.
 * sign = SHA256( apiKey + timestamp )  →  lowercase hex digest
 *
 * @param {string} apiKey
 * @param {number} timestamp — Unix seconds
 * @returns {string}
 */
function buildSign(apiKey, timestamp) {
  return createHash('sha256')
    .update(apiKey + timestamp)
    .digest('hex');
}

/**
 * Low-level fetch wrapper with:
 *   • 3 retries + exponential back-off on 5xx
 *   • Structured error logging
 *
 * Does NOT handle 401 (caller is responsible).
 *
 * @param {string}         url
 * @param {RequestInit}    options
 * @param {string}         label   — human-readable label for logs
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, label) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, options);

      // Successful or client-error (non-5xx): return immediately
      if (res.status < 500) {
        return res;
      }

      // 5xx — log and retry
      const bodyText = await res.text().catch(() => '(unreadable body)');
      lastError = new Error(
        `[Digiseller] ${label}: HTTP ${res.status} — ${bodyText}`
      );
      console.warn(
        `[Digiseller] ${label}: 5xx error (attempt ${attempt + 1}/${MAX_RETRIES + 1}). ` +
          `Status: ${res.status}. Body: ${bodyText.slice(0, 300)}`
      );
    } catch (networkErr) {
      lastError = networkErr;
      console.warn(
        `[Digiseller] ${label}: Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${networkErr.message}`
      );
    }

    // Back-off before next attempt (skip sleep after the final attempt)
    if (attempt < MAX_RETRIES) {
      const delayMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error(`[Digiseller] ${label}: All retries exhausted`);
}

/**
 * Parse a JSON response, providing a clear error when parsing fails.
 *
 * @param {Response} res
 * @param {string}   label
 * @returns {Promise<any>}
 */
async function parseJSON(res, label) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `[Digiseller] ${label}: Failed to parse JSON response — ${text.slice(0, 500)}`
    );
  }
}

// ─── Authentication ───────────────────────────────────────────────────────────

/**
 * Perform a fresh login against /api/apilogin and cache the token.
 *
 * @returns {Promise<string>} The fresh API token.
 */
async function authenticate() {
  const { sellerId, apiKey } = getEnvConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = buildSign(apiKey, timestamp);

  console.log('[Digiseller] Authenticating (seller_id=%d)…', sellerId);

  const res = await fetchWithRetry(
    `${BASE_URL}/api/apilogin`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ seller_id: sellerId, timestamp, sign }),
    },
    'authenticate'
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `[Digiseller] Authentication failed: HTTP ${res.status} — ${body.slice(0, 500)}`
    );
  }

  const data = await parseJSON(res, 'authenticate');

  if (data.retval !== 0 || !data.token) {
    throw new Error(
      `[Digiseller] Authentication rejected: retval=${data.retval}, response=${JSON.stringify(data).slice(0, 500)}`
    );
  }

  cachedToken = data.token;
  tokenObtainedAt = Date.now();

  console.log(
    '[Digiseller] Authenticated successfully. Token valid until %s',
    data.valid_thru || 'unknown'
  );

  return cachedToken;
}

/**
 * Force-refresh the token (coalesces concurrent callers).
 *
 * @returns {Promise<string>}
 */
async function refreshToken() {
  // If another caller is already refreshing, piggy-back on that promise
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = authenticate().finally(() => {
    tokenRefreshPromise = null;
  });

  return tokenRefreshPromise;
}

/**
 * Get a valid API token, refreshing proactively if it is about to expire.
 * Exported for external callers who need raw token access.
 *
 * @returns {Promise<string>}
 */
export async function getToken() {
  // Check whether the cached token is still fresh
  if (
    cachedToken &&
    Date.now() - tokenObtainedAt < TOKEN_REFRESH_THRESHOLD_MS
  ) {
    return cachedToken;
  }

  // Token missing or about to expire — refresh
  return refreshToken();
}

// ─── Authorized request helper ────────────────────────────────────────────────

/**
 * Make an authenticated API request.
 * Automatically appends the token, handles 401 by refreshing and retrying once.
 *
 * @param {'GET' | 'POST'} method
 * @param {string}         path        — e.g. '/api/purchase/info/12345'
 * @param {object}         [options]
 * @param {Record<string,string>} [options.queryParams]  — extra query-string params
 * @param {any}            [options.body]               — JSON body (for POST)
 * @param {string}         [options.contentType]        — override Content-Type
 * @param {string}         [options.rawBody]            — raw string body (for form encoding)
 * @param {string}         label                        — log label
 * @returns {Promise<any>} Parsed JSON body
 */
async function authorizedRequest(method, path, options = {}, label = path) {
  /**
   * Internal helper that executes the actual fetch.
   * @param {string} token
   */
  const execute = async (token) => {
    const url = new URL(path, BASE_URL);
    url.searchParams.set('token', token);

    if (options.queryParams) {
      for (const [k, v] of Object.entries(options.queryParams)) {
        url.searchParams.set(k, v);
      }
    }

    /** @type {RequestInit} */
    const fetchOpts = {
      method,
      headers: { Accept: 'application/json' },
    };

    if (options.rawBody !== undefined) {
      fetchOpts.body = options.rawBody;
      fetchOpts.headers['Content-Type'] =
        options.contentType || 'application/x-www-form-urlencoded';
    } else if (options.body !== undefined) {
      fetchOpts.body = JSON.stringify(options.body);
      fetchOpts.headers['Content-Type'] =
        options.contentType || 'application/json';
    }

    return fetchWithRetry(url.toString(), fetchOpts, label);
  };

  // First attempt
  let token = await getToken();
  let res = await execute(token);

  // On 401 — refresh token and retry exactly once
  if (res.status === 401) {
    console.warn('[Digiseller] %s: 401 received — refreshing token and retrying…', label);
    token = await refreshToken();
    res = await execute(token);

    if (res.status === 401) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `[Digiseller] ${label}: Still 401 after token refresh — ${body.slice(0, 500)}`
      );
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `[Digiseller] ${label}: HTTP ${res.status} — ${body.slice(0, 500)}`
    );
  }

  return parseJSON(res, label);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch new orders (sales) since a given date.
 *
 * @param {Date | string} sinceDate — Start date; accepts Date object or ISO/yyyy-MM-dd string.
 * @param {object}        [opts]
 * @param {number[]}      [opts.productIds]  — filter by specific product IDs
 * @param {number}        [opts.page]        — page number (default 1)
 * @param {number}        [opts.rows]        — rows per page (default 20)
 * @returns {Promise<Array<object>>} Array of order summary objects from the API.
 */
export async function getNewOrders(sinceDate, opts = {}) {
  if (!sinceDate) {
    throw new Error('[Digiseller] getNewOrders: sinceDate is required');
  }

  const start = formatDigisellerDate(sinceDate);
  const finish = formatDigisellerDate(new Date());

  const body = {
    date_start: start,
    date_finish: finish,
    returned: 0,
    page: opts.page ?? 1,
    rows: opts.rows ?? 20,
  };

  if (Array.isArray(opts.productIds) && opts.productIds.length > 0) {
    body.product_ids = opts.productIds;
  }

  console.log(
    '[Digiseller] Fetching orders from %s to %s (page %d, rows %d)',
    start,
    finish,
    body.page,
    body.rows
  );

  const data = await authorizedRequest(
    'POST',
    '/api/seller-sells/v2',
    { body },
    'getNewOrders'
  );

  // The API nests the actual rows inside data.rows or data.sells depending on version
  const orders = data?.rows ?? data?.sells ?? data?.content?.rows ?? [];

  if (!Array.isArray(orders)) {
    console.warn(
      '[Digiseller] getNewOrders: Unexpected response shape — returning raw data. Keys: %s',
      Object.keys(data || {}).join(', ')
    );
    return [];
  }

  console.log('[Digiseller] getNewOrders: Received %d order(s)', orders.length);
  return orders;
}

/**
 * Fetch full details for a single order by its invoice ID.
 *
 * @param {number|string} invoiceId — The unique invoice/order ID.
 * @returns {Promise<object>} Full order details (buyer email, product info, amounts, etc.)
 */
export async function getOrderInfo(invoiceId) {
  if (invoiceId == null || invoiceId === '') {
    throw new Error('[Digiseller] getOrderInfo: invoiceId is required');
  }

  const id = String(invoiceId);
  console.log('[Digiseller] Fetching order info for invoice #%s', id);

  const data = await authorizedRequest(
    'GET',
    `/api/purchase/info/${encodeURIComponent(id)}`,
    {},
    `getOrderInfo(${id})`
  );

  if (!data) {
    throw new Error(
      `[Digiseller] getOrderInfo(${id}): Empty response from API`
    );
  }

  return data;
}

/**
 * Send a chat message to the buyer on a specific order.
 * Uses application/x-www-form-urlencoded encoding as required by the API.
 *
 * @param {number|string} invoiceId — The invoice ID whose chat to post to.
 * @param {string}        message   — The message text to send.
 * @returns {Promise<boolean>} true if the API accepted the message.
 */
export async function sendChatMessage(invoiceId, message) {
  if (invoiceId == null || invoiceId === '') {
    throw new Error('[Digiseller] sendChatMessage: invoiceId is required');
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('[Digiseller] sendChatMessage: message must be a non-empty string');
  }

  const id = String(invoiceId);

  console.log(
    '[Digiseller] Sending chat message to invoice #%s (%d chars)',
    id,
    message.length
  );

  // Build URL-encoded form body
  const encodedBody = `message=${encodeURIComponent(message)}`;

  const data = await authorizedRequest(
    'POST',
    '/api/debates/v2',
    {
      queryParams: { id_i: id },
      rawBody: encodedBody,
      contentType: 'application/x-www-form-urlencoded',
    },
    `sendChatMessage(${id})`
  );

  // The API typically returns retval: 0 on success
  const success = data?.retval === 0 || data?.retval === '0';

  if (success) {
    console.log('[Digiseller] Chat message sent successfully to invoice #%s', id);
  } else {
    console.warn(
      '[Digiseller] Chat message may have failed for invoice #%s. Response: %s',
      id,
      JSON.stringify(data).slice(0, 500)
    );
  }

  return success;
}

/**
 * Fetch the list of seller's products.
 *
 * @param {object} [opts]
 * @param {number} [opts.page]    — page number (default 1)
 * @param {number} [opts.rows]    — rows per page (default 100)
 * @returns {Promise<Array<object>>} Array of product objects.
 */
export async function getSellerProducts(opts = {}) {
  const page = opts.page ?? 1;
  const rows = opts.rows ?? 100;

  console.log('[Digiseller] Fetching seller products (page %d, rows %d)', page, rows);

  const data = await authorizedRequest(
    'GET',
    '/api/seller-goods',
    {
      queryParams: {
        page: String(page),
        rows: String(rows),
      },
    },
    'getSellerProducts'
  );

  const products = data?.rows ?? data?.products ?? data?.content?.products ?? [];

  if (!Array.isArray(products)) {
    console.warn(
      '[Digiseller] getSellerProducts: Unexpected response shape. Keys: %s',
      Object.keys(data || {}).join(', ')
    );
    return [];
  }

  console.log('[Digiseller] getSellerProducts: Received %d product(s)', products.length);
  return products;
}

/**
 * Attempt to deactivate/hide all seller products (kill-switch).
 *
 * Strategy:
 *   1. Fetch all products via paginated calls to getSellerProducts.
 *   2. For each product, POST to /api/product/edit/base/{product_id} with
 *      enabled: false / hidden: true to disable it.
 *   3. Track successes and failures.
 *
 * @returns {Promise<{ success: boolean, deactivated: string[], failed: string[] }>}
 */
export async function deactivateAllProducts() {
  console.log('[Digiseller] ═══ KILL-SWITCH: Deactivating all products ═══');

  /** @type {string[]} */
  const deactivated = [];
  /** @type {string[]} */
  const failed = [];

  // ── Step 1: Collect all products across pages ──────────────────────────────
  /** @type {Array<object>} */
  let allProducts = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  while (hasMore) {
    try {
      const batch = await getSellerProducts({ page, rows: perPage });
      if (batch.length === 0) {
        hasMore = false;
      } else {
        allProducts = allProducts.concat(batch);
        page++;
        // Safety limit to avoid infinite loops
        if (page > 100) {
          console.warn('[Digiseller] deactivateAllProducts: Reached page limit (100). Stopping pagination.');
          hasMore = false;
        }
      }
    } catch (err) {
      console.error(
        '[Digiseller] deactivateAllProducts: Error fetching product page %d: %s',
        page,
        err.message
      );
      hasMore = false;
    }
  }

  if (allProducts.length === 0) {
    console.warn('[Digiseller] deactivateAllProducts: No products found.');
    return { success: true, deactivated, failed };
  }

  console.log(
    '[Digiseller] deactivateAllProducts: Found %d product(s) to deactivate',
    allProducts.length
  );

  // ── Step 2: Deactivate each product ────────────────────────────────────────
  for (const product of allProducts) {
    // Products may have id_goods, id, or product_id depending on the endpoint
    const productId = product.id_goods ?? product.id ?? product.product_id;

    if (productId == null) {
      console.warn(
        '[Digiseller] deactivateAllProducts: Skipping product with no ID. Keys: %s',
        Object.keys(product).join(', ')
      );
      failed.push('unknown-id');
      continue;
    }

    const pid = String(productId);

    try {
      await authorizedRequest(
        'POST',
        `/api/product/edit/base/${encodeURIComponent(pid)}`,
        {
          body: {
            enabled: false,
            hidden: true,
          },
        },
        `deactivateProduct(${pid})`
      );

      deactivated.push(pid);
      console.log('[Digiseller] Deactivated product #%s', pid);
    } catch (err) {
      console.error(
        '[Digiseller] Failed to deactivate product #%s: %s',
        pid,
        err.message
      );
      failed.push(pid);
    }
  }

  const success = failed.length === 0;

  console.log(
    '[Digiseller] ═══ KILL-SWITCH COMPLETE: %d deactivated, %d failed ═══',
    deactivated.length,
    failed.length
  );

  return { success, deactivated, failed };
}

// ─── Date formatting helper ───────────────────────────────────────────────────

/**
 * Format a date to the Digiseller-expected format: 'yyyy-MM-dd HH:mm:ss'
 * Accepts Date objects, ISO strings, or 'yyyy-MM-dd' strings.
 *
 * @param {Date | string} input
 * @returns {string}
 */
function formatDigisellerDate(input) {
  let d;

  if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'string') {
    d = new Date(input);
  } else {
    throw new Error(
      `[Digiseller] formatDigisellerDate: Invalid input type "${typeof input}"`
    );
  }

  if (isNaN(d.getTime())) {
    throw new Error(
      `[Digiseller] formatDigisellerDate: Could not parse date "${input}"`
    );
  }

  const pad = (n) => String(n).padStart(2, '0');

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * @fileoverview Shared utility functions for the Digiseller-Telegram
 * dropshipping platform. All helpers are pure / side-effect-free
 * (except `sleep`) and safe to call from any environment (server / edge).
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically secure random hex token.
 *
 * @param {number} [length=32] - Desired length **in bytes** (output hex string
 *   will be twice this value).
 * @returns {string} Hex-encoded random string.
 * @throws {RangeError} If length is not a positive integer.
 */
function generateSecureToken(length = 32) {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError(
      `[generateSecureToken] length must be a positive integer, got ${length}`
    );
  }
  return crypto.randomBytes(length).toString('hex');
}

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

/**
 * Returns a Promise that resolves after the specified number of milliseconds.
 *
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  if (typeof ms !== 'number' || ms < 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to parse a JSON string. Returns `null` on failure instead of
 * throwing, which is handy for untrusted / optional input.
 *
 * @param {string} str - The string to parse.
 * @returns {any|null} Parsed value, or `null` if parsing fails.
 */
function safeJsonParse(str) {
  if (typeof str !== 'string') {
    return null;
  }
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Text sanitisation
// ---------------------------------------------------------------------------

/**
 * Strips internal details from a text string before showing it to end-users.
 *
 * Removes:
 * - Stack traces (lines starting with "at ")
 * - Internal file paths (e.g. /home/user/..., C:\Users\..., /var/...)
 * - Environment variable names (UPPER_SNAKE_CASE words ≥ 3 chars with underscores)
 * - API keys / tokens (hex or base64 blobs ≥ 20 chars)
 * - UUIDs
 *
 * @param {string} text - Raw text that may contain internal information.
 * @returns {string} Sanitised text safe for customer-facing contexts.
 */
function sanitizeForCustomer(text) {
  if (typeof text !== 'string') {
    return '';
  }

  let sanitized = text;

  // Remove stack-trace lines
  sanitized = sanitized.replace(/^\s*at\s+.+$/gm, '');

  // Remove Unix-style absolute paths
  sanitized = sanitized.replace(/\/(?:home|var|usr|tmp|etc|opt|srv)\/\S+/g, '[path]');

  // Remove Windows-style absolute paths
  sanitized = sanitized.replace(/[A-Z]:\\[\w\\.\- ]+/gi, '[path]');

  // Remove env-var-style tokens (UPPER_SNAKE with ≥ 1 underscore, ≥ 6 chars)
  sanitized = sanitized.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,}\b/g, '[REDACTED]');

  // Remove long hex/base64 blobs that look like keys or tokens
  sanitized = sanitized.replace(/\b[a-fA-F0-9]{20,}\b/g, '[REDACTED]');
  sanitized = sanitized.replace(
    /\b[A-Za-z0-9+/]{20,}={0,2}\b/g,
    '[REDACTED]'
  );

  // Remove UUIDs
  sanitized = sanitized.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    '[id]'
  );

  // Collapse multiple blank lines
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();

  return sanitized;
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

/**
 * Formats a numeric amount as a human-readable currency string.
 *
 * @param {number} amount - The monetary value.
 * @param {string} [currency='VND'] - ISO 4217 currency code.
 * @returns {string} Formatted string, e.g. "1,250,000 ₫" or "$12.50".
 */
function formatCurrency(amount, currency = 'VND') {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return `0 ${currency}`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      // VND and similar zero-decimal currencies should show 0 fraction digits
      minimumFractionDigits: currency === 'VND' ? 0 : 2,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(amount);
  } catch {
    // Fallback if Intl is unavailable or currency code is invalid
    return `${amount.toLocaleString()} ${currency}`;
  }
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

/**
 * Map of email TLDs / domain fragments to language codes.
 * @type {Record<string, string>}
 */
const DOMAIN_LANGUAGE_MAP = {
  // French
  '.fr': 'fr',
  '.be': 'fr',
  '.ch': 'fr',
  '.ca': 'fr',
  'laposte.net': 'fr',
  'orange.fr': 'fr',
  'sfr.fr': 'fr',
  'free.fr': 'fr',
  'wanadoo.fr': 'fr',

  // Arabic
  '.sa': 'ar',
  '.ae': 'ar',
  '.eg': 'ar',
  '.ma': 'ar',
  '.dz': 'ar',
  '.tn': 'ar',
  '.qa': 'ar',
  '.kw': 'ar',
  '.bh': 'ar',
  '.om': 'ar',
  '.jo': 'ar',
  '.iq': 'ar',
  '.lb': 'ar',
  '.ly': 'ar',

  // Russian
  '.ru': 'ru',
  '.by': 'ru',
  '.kz': 'ru',
  '.ua': 'ru',
  'mail.ru': 'ru',
  'yandex.ru': 'ru',
  'yandex.com': 'ru',
  'rambler.ru': 'ru',

  // Chinese
  '.cn': 'zh',
  '.tw': 'zh',
  '.hk': 'zh',
  'qq.com': 'zh',
  '163.com': 'zh',
  '126.com': 'zh',
  'sina.com': 'zh',
  'sohu.com': 'zh',
  'aliyun.com': 'zh',
};

/**
 * Attempts to detect the buyer's preferred language from their email address
 * and optional buyer information object.
 *
 * Checks (in order of priority):
 * 1. Explicit `language` or `lang` field in `buyerInfo`
 * 2. Full domain match (e.g. `mail.ru`)
 * 3. TLD match (e.g. `.fr`)
 *
 * Falls back to `'en'` if no heuristic matches.
 *
 * @param {string|null|undefined} email - Buyer email address.
 * @param {Record<string, any>|null|undefined} buyerInfo - Optional buyer data
 *   that may contain a `language` or `lang` field.
 * @returns {'en'|'fr'|'ar'|'ru'|'zh'} Detected language code.
 */
function detectLanguage(email, buyerInfo) {
  const SUPPORTED = new Set(['en', 'fr', 'ar', 'ru', 'zh']);

  // 1. Explicit language in buyer info
  if (buyerInfo && typeof buyerInfo === 'object') {
    const explicit = (buyerInfo.language || buyerInfo.lang || '').toString().toLowerCase().slice(0, 2);
    if (SUPPORTED.has(explicit)) {
      return /** @type {'en'|'fr'|'ar'|'ru'|'zh'} */ (explicit);
    }
  }

  // 2. Email domain heuristics
  if (typeof email === 'string' && email.includes('@')) {
    const domain = email.split('@').pop().toLowerCase();

    // Check full domain first (more specific)
    for (const [pattern, lang] of Object.entries(DOMAIN_LANGUAGE_MAP)) {
      if (!pattern.startsWith('.') && domain.includes(pattern)) {
        return /** @type {'en'|'fr'|'ar'|'ru'|'zh'} */ (lang);
      }
    }

    // Check TLD
    for (const [pattern, lang] of Object.entries(DOMAIN_LANGUAGE_MAP)) {
      if (pattern.startsWith('.') && domain.endsWith(pattern)) {
        return /** @type {'en'|'fr'|'ar'|'ru'|'zh'} */ (lang);
      }
    }
  }

  // 3. Default
  return 'en';
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Determines whether an error is retryable (server-side / transient) or
 * permanent (client error).
 *
 * Retryable: 5xx HTTP status, network errors, timeouts, ECONNRESET, etc.
 * Not retryable: 4xx HTTP status, validation errors, auth errors.
 *
 * @param {Error & { status?: number; statusCode?: number; code?: string; response?: { status?: number } }} error
 * @returns {boolean} `true` if the request should be retried.
 */
function isRetryableError(error) {
  if (!error) {
    return false;
  }

  // Network-level error codes
  const RETRYABLE_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EPIPE',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_SOCKET',
  ]);

  if (error.code && RETRYABLE_CODES.has(error.code)) {
    return true;
  }

  // Timeout in error message
  if (error.message && /timeout|timed?\s*out/i.test(error.message)) {
    return true;
  }

  // HTTP status codes
  const status =
    error.status ||
    error.statusCode ||
    (error.response && error.response.status) ||
    0;

  if (status >= 500 && status < 600) {
    return true;
  }

  // 429 Too Many Requests is retryable (rate-limited)
  if (status === 429) {
    return true;
  }

  // 4xx errors (except 429) are NOT retryable
  if (status >= 400 && status < 500) {
    return false;
  }

  // If there's no status, assume it's a network/unknown error → retryable
  if (status === 0 && error instanceof Error) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/**
 * Truncates a string to `maxLen` characters, appending an ellipsis ("…") if
 * truncation occurs. Returns the original string if it is already short enough.
 *
 * @param {string} str - Input string.
 * @param {number} [maxLen=200] - Maximum allowed length (including ellipsis).
 * @returns {string} Truncated (or original) string.
 */
function truncate(str, maxLen = 200) {
  if (typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 1) + '…';
}

export {
  generateSecureToken,
  sleep,
  safeJsonParse,
  sanitizeForCustomer,
  formatCurrency,
  detectLanguage,
  isRetryableError,
  truncate,
};

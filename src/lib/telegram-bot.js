/**
 * @fileoverview Telegram Bot API wrapper for admin notifications.
 *
 * Sends operational alerts (success, failure, emergency, balance warnings)
 * to the admin Telegram chat. All functions swallow errors so that a
 * notification failure never crashes the main business flow.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN   - Bot token from @BotFather
 *   ADMIN_TELEGRAM_ID    - Numeric chat/user ID of the admin
 */

import {  truncate  } from './utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Maximum length for a single Telegram message (UTF-8).
 * Telegram's hard limit is 4096 characters.
 * @type {number}
 */
const MAX_MESSAGE_LENGTH = 4000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the bot token from environment variables.
 * @returns {string|null} Token or null if not configured.
 */
function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

/**
 * Returns the admin chat ID from environment variables.
 * @returns {string|null} Chat ID or null if not configured.
 */
function getAdminChatId() {
  return process.env.ADMIN_TELEGRAM_ID || null;
}

/**
 * Sends a raw text message to a Telegram chat via the Bot API.
 *
 * @param {string} chatId  - Target chat / user ID.
 * @param {string} text    - Message body (HTML parse mode).
 * @param {object} [options]
 * @param {boolean} [options.disableNotification=false] - Send silently.
 * @returns {Promise<object|null>} Telegram API response, or null on failure.
 */
async function sendTelegramMessage(chatId, text, options = {}) {
  const token = getBotToken();
  if (!token) {
    console.warn('[Telegram] BOT_TOKEN is not set — skipping message.');
    return null;
  }

  if (!chatId) {
    console.warn('[Telegram] chatId is empty — skipping message.');
    return null;
  }

  // Telegram rejects messages longer than 4096 chars; truncate defensively.
  const safeText = truncate(text, MAX_MESSAGE_LENGTH);

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;

  const body = {
    chat_id: chatId,
    text: safeText,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    disable_notification: Boolean(options.disableNotification),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000), // 10 s timeout
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(unreadable body)');
      console.error(
        `[Telegram] sendMessage failed: ${response.status} — ${errorBody}`
      );
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Telegram] Network / fetch error:', error.message);
    return null;
  }
}

/**
 * Escapes HTML special characters for Telegram HTML parse mode.
 *
 * @param {string} str - Raw string.
 * @returns {string} Escaped string safe for HTML mode.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a general admin alert message.
 *
 * @param {string} message - Alert text (plain text; will be HTML-escaped).
 * @param {boolean} [urgent=false] - If true, prefix with emergency emojis.
 * @returns {Promise<void>}
 */
async function sendAdminAlert(message, urgent = false) {
  const chatId = getAdminChatId();
  if (!chatId) {
    console.warn('[Telegram] ADMIN_TELEGRAM_ID not set — alert dropped.');
    return;
  }

  const prefix = urgent ? '🚨🚨🚨 <b>EMERGENCY</b>\n\n' : '⚠️ <b>Admin Alert</b>\n\n';
  const text = `${prefix}${escapeHtml(message)}`;

  await sendTelegramMessage(chatId, text, {
    disableNotification: !urgent,
  });
}

/**
 * Sends a formatted success notification for a completed order.
 *
 * @param {object} orderData
 * @param {string} [orderData.orderCode]        - Platform order code.
 * @param {string} [orderData.productName]       - Name of the purchased product.
 * @param {number} [orderData.quantity]           - Quantity purchased.
 * @param {number} [orderData.unitPrice]          - Unit price.
 * @param {string} [orderData.customerEmail]      - Buyer email.
 * @param {string} [orderData.status]             - Order status.
 * @param {object} [orderData.settlement]         - Settlement info.
 * @param {number} [orderData.settlement.totalAmount] - Total settlement amount.
 * @param {number} [orderData.settlement.walletBalanceAfter] - Remaining balance.
 * @returns {Promise<void>}
 */
async function sendSuccessNotification(orderData) {
  const chatId = getAdminChatId();
  if (!chatId) return;

  if (!orderData || typeof orderData !== 'object') {
    console.warn('[Telegram] sendSuccessNotification called with invalid orderData.');
    return;
  }

  const lines = [
    '✅ <b>Order Completed Successfully</b>',
    '',
    `📦 <b>Product:</b> ${escapeHtml(orderData.productName || 'N/A')}`,
    `🔖 <b>Order Code:</b> <code>${escapeHtml(orderData.orderCode || 'N/A')}</code>`,
    `📊 <b>Quantity:</b> ${orderData.quantity ?? 'N/A'}`,
    `💵 <b>Unit Price:</b> ${orderData.unitPrice ?? 'N/A'}`,
    `📧 <b>Customer:</b> ${escapeHtml(orderData.customerEmail || 'N/A')}`,
    `📌 <b>Status:</b> ${escapeHtml(orderData.status || 'N/A')}`,
  ];

  if (orderData.settlement) {
    const s = orderData.settlement;
    lines.push('');
    lines.push('💰 <b>Settlement</b>');
    if (s.totalAmount != null) {
      lines.push(`  Total: ${s.totalAmount}`);
    }
    if (s.walletBalanceAfter != null) {
      lines.push(`  Balance After: ${s.walletBalanceAfter}`);
    }
  }

  await sendTelegramMessage(chatId, lines.join('\n'));
}

/**
 * Sends a formatted failure notification for a failed order.
 *
 * @param {object} orderData
 * @param {string} [orderData.orderCode]   - Platform order code (if available).
 * @param {string} [orderData.productName] - Product name.
 * @param {number} [orderData.quantity]    - Attempted quantity.
 * @param {string} [orderData.customerEmail] - Buyer email.
 * @param {Error|string} error             - The error that caused the failure.
 * @returns {Promise<void>}
 */
async function sendFailureNotification(orderData, error) {
  const chatId = getAdminChatId();
  if (!chatId) return;

  const safeOrder = orderData && typeof orderData === 'object' ? orderData : {};
  const errorMessage =
    error instanceof Error ? error.message : String(error ?? 'Unknown error');

  const lines = [
    '❌ <b>Order FAILED</b>',
    '',
    `📦 <b>Product:</b> ${escapeHtml(safeOrder.productName || 'N/A')}`,
    `🔖 <b>Order Code:</b> <code>${escapeHtml(safeOrder.orderCode || 'N/A')}</code>`,
    `📊 <b>Quantity:</b> ${safeOrder.quantity ?? 'N/A'}`,
    `📧 <b>Customer:</b> ${escapeHtml(safeOrder.customerEmail || 'N/A')}`,
    '',
    `🛑 <b>Error:</b>`,
    `<pre>${escapeHtml(errorMessage)}</pre>`,
  ];

  await sendTelegramMessage(chatId, lines.join('\n'));
}

/**
 * Sends a critical emergency alert. Used when a kill-switch is triggered
 * or the system enters an unrecoverable state.
 *
 * @param {string} reason  - Human-readable reason for the emergency.
 * @param {object} [context] - Arbitrary context data to include.
 * @returns {Promise<void>}
 */
async function sendEmergencyAlert(reason, context) {
  const chatId = getAdminChatId();
  if (!chatId) return;

  const lines = [
    '🚨🚨🚨 <b>CRITICAL — KILL-SWITCH TRIGGERED</b>',
    '',
    `<b>Reason:</b> ${escapeHtml(String(reason || 'No reason provided'))}`,
    '',
    `<b>Timestamp:</b> ${new Date().toISOString()}`,
  ];

  if (context && typeof context === 'object') {
    lines.push('');
    lines.push('<b>Context:</b>');
    try {
      const contextStr = JSON.stringify(context, null, 2);
      lines.push(`<pre>${escapeHtml(contextStr)}</pre>`);
    } catch {
      lines.push('<pre>(context not serializable)</pre>');
    }
  }

  // Emergency messages are NEVER silent
  await sendTelegramMessage(chatId, lines.join('\n'), {
    disableNotification: false,
  });
}

/**
 * Sends a low-balance warning to the admin.
 *
 * @param {number} balance - Current wallet balance.
 * @returns {Promise<void>}
 */
async function sendBalanceWarning(balance) {
  const chatId = getAdminChatId();
  if (!chatId) return;

  const lines = [
    '💰 <b>Low Balance Warning</b>',
    '',
    `Your current wallet balance is <b>${balance ?? 'unknown'}</b>.`,
    '',
    'Please top up your account to avoid failed purchases.',
    '',
    `⏰ ${new Date().toISOString()}`,
  ];

  await sendTelegramMessage(chatId, lines.join('\n'));
}

export {
  sendAdminAlert,
  sendSuccessNotification,
  sendFailureNotification,
  sendEmergencyAlert,
  sendBalanceWarning,
};

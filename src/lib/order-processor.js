/**
 * Order Processor — Core Orchestration Engine
 * 
 * This module is the "brain" of the automated dropshipping system.
 * It orchestrates the full lifecycle of an order:
 *   1. Detect new order → Save to Firestore
 *   2. Send initial contact message via Digiseller chat
 *   3. Purchase product from Canboso Telegram Seller API
 *   4. Deliver credentials to customer (web + chat)
 *   5. Handle failures with kill-switch emergency protocol
 * 
 * CRITICAL: This code is designed to protect the Digiseller seller rating
 * at all costs. Every failure path sends reassuring messages to the customer.
 */

import { db, admin } from './firebase.js';
import { buyProduct, listProducts } from './canboso.js';
import {
  getOrderInfo,
  sendChatMessage,
  deactivateAllProducts,
  getToken,
} from './digiseller.js';
import {
  sendSuccessNotification,
  sendFailureNotification,
  sendEmergencyAlert,
  sendBalanceWarning,
  sendAdminAlert,
} from './telegram-bot.js';
import {
  getInitialContactMessage,
  getDeliverySuccessMessage,
  getDeliveryFailureMessage,
} from './messages.js';
import { detectLanguage, isRetryableError, truncate } from './utils.js';

const COLLECTION_ORDERS = 'orders';
const COLLECTION_LOGS = 'logs';
const COLLECTION_MAPPINGS = 'product_mappings';
const COLLECTION_SETTINGS = 'settings';

const MAX_RETRIES = 3;
const KILL_SWITCH_CONSECUTIVE_FAILURES = 3;

// ─────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────

/**
 * Write a structured log entry to Firestore.
 * @param {string} orderId - Related order ID
 * @param {string} action - Action name (e.g. "purchase_attempt")
 * @param {string} level - "info" | "warn" | "error"
 * @param {string} message - Human-readable log message
 * @param {object} [metadata={}] - Additional context
 */
async function log(orderId, action, level, message, metadata = {}) {
  try {
    await db.collection(COLLECTION_LOGS).add({
      orderId,
      action,
      level,
      message,
      metadata: JSON.parse(JSON.stringify(metadata)), // Sanitize for Firestore
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Logging should never crash the main flow
    console.error(`[LOG_ERROR] Failed to write log: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────
// Emergency Kill-Switch
// ─────────────────────────────────────────────────────────

/**
 * Check if the emergency kill-switch is active.
 * When active, no new orders should be processed.
 * @returns {Promise<boolean>}
 */
export async function isEmergencyActive() {
  try {
    const doc = await db.collection(COLLECTION_SETTINGS).doc('emergency').get();
    if (!doc.exists) return false;
    return doc.data()?.active === true;
  } catch (err) {
    console.error(`[EMERGENCY_CHECK] Error checking emergency status: ${err.message}`);
    // If we can't check, assume NOT in emergency (fail-open for processing)
    return false;
  }
}

/**
 * Trigger the emergency kill-switch.
 * This will:
 *   1. Set emergency.active = true in Firestore
 *   2. Send URGENT Telegram alert to admin
 *   3. Attempt to deactivate all Digiseller products
 *   4. Block all new order processing
 * 
 * @param {string} reason - Why the kill-switch was triggered
 * @param {object} context - Additional context (order details, error, etc.)
 */
async function triggerKillSwitch(reason, context = {}) {
  console.error(`[KILL_SWITCH] 🚨 EMERGENCY TRIGGERED: ${reason}`);

  try {
    // 1. Set emergency flag in Firestore
    await db.collection(COLLECTION_SETTINGS).doc('emergency').set({
      active: true,
      reason,
      context: JSON.parse(JSON.stringify(context)),
      triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await log('SYSTEM', 'kill_switch_triggered', 'error', reason, context);
  } catch (err) {
    console.error(`[KILL_SWITCH] Failed to set emergency flag: ${err.message}`);
  }

  // 2. Send URGENT Telegram alert (fire and forget, don't block)
  try {
    await sendEmergencyAlert(reason, context);
  } catch (err) {
    console.error(`[KILL_SWITCH] Failed to send Telegram alert: ${err.message}`);
  }

  // 3. Attempt to deactivate Digiseller products
  try {
    const result = await deactivateAllProducts();
    console.log(`[KILL_SWITCH] Product deactivation result:`, result);
    await log('SYSTEM', 'products_deactivated', 'warn',
      `Deactivated ${result.deactivated?.length || 0} products, ${result.failed?.length || 0} failed`,
      result
    );
  } catch (err) {
    console.error(`[KILL_SWITCH] Failed to deactivate products: ${err.message}`);
    await log('SYSTEM', 'products_deactivation_failed', 'error', err.message);
  }
}

/**
 * Reset the emergency kill-switch (admin action).
 */
export async function resetEmergency() {
  await db.collection(COLLECTION_SETTINGS).doc('emergency').set({
    active: false,
    resetAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await log('SYSTEM', 'kill_switch_reset', 'info', 'Emergency kill-switch deactivated by admin');
  await sendAdminAlert('✅ Emergency kill-switch has been deactivated. Order processing resumed.');
}

// ─────────────────────────────────────────────────────────
// Consecutive Failure Tracking
// ─────────────────────────────────────────────────────────

/**
 * Track consecutive failures and trigger kill-switch if threshold exceeded.
 * @param {boolean} success - Whether the last operation succeeded
 */
async function trackConsecutiveFailures(success) {
  const ref = db.collection(COLLECTION_SETTINGS).doc('failure_tracker');

  if (success) {
    // Reset counter on success
    await ref.set({ consecutiveFailures: 0, lastSuccessAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return;
  }

  try {
    const doc = await ref.get();
    const current = doc.exists ? (doc.data().consecutiveFailures || 0) : 0;
    const newCount = current + 1;

    await ref.set({
      consecutiveFailures: newCount,
      lastFailureAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (newCount >= KILL_SWITCH_CONSECUTIVE_FAILURES) {
      await triggerKillSwitch(
        `${newCount} consecutive purchase failures detected`,
        { consecutiveFailures: newCount }
      );
    }
  } catch (err) {
    console.error(`[FAILURE_TRACKER] Error tracking failures: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────
// Product Mapping
// ─────────────────────────────────────────────────────────

/**
 * Look up the Canboso product ID for a given Digiseller product.
 * @param {number|string} digisellerProductId
 * @returns {Promise<object|null>} Mapping object or null
 */
async function getProductMapping(digisellerProductId) {
  try {
    const snapshot = await db.collection(COLLECTION_MAPPINGS)
      .where('digisellerProductId', '==', Number(digisellerProductId))
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (err) {
    console.error(`[MAPPING] Error looking up mapping for product ${digisellerProductId}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// Core Order Processing
// ─────────────────────────────────────────────────────────

/**
 * Check if an order already exists in Firestore (idempotency guard).
 * @param {string} invoiceId - Digiseller invoice ID
 * @returns {Promise<boolean>}
 */
async function orderExists(invoiceId) {
  const doc = await db.collection(COLLECTION_ORDERS).doc(String(invoiceId)).get();
  return doc.exists;
}

/**
 * Process a new order end-to-end.
 * This is the main entry point called by the webhook and cron handlers.
 * 
 * @param {string} invoiceId - Digiseller invoice ID
 * @returns {Promise<{success: boolean, status: string, error?: string}>}
 */
export async function processNewOrder(invoiceId) {
  const orderId = String(invoiceId);
  console.log(`[ORDER] Processing order ${orderId}...`);

  // ── Guard: Emergency mode ──
  if (await isEmergencyActive()) {
    console.warn(`[ORDER] Emergency mode active, skipping order ${orderId}`);
    await log(orderId, 'emergency_skip', 'warn', 'Order skipped due to active emergency mode');
    return { success: false, status: 'emergency_active', error: 'System in emergency mode' };
  }

  // ── Guard: Idempotency ──
  if (await orderExists(orderId)) {
    const existing = await db.collection(COLLECTION_ORDERS).doc(orderId).get();
    const existingStatus = existing.data()?.status;

    // If already delivered or in manual review, skip entirely
    if (['delivered', 'manual_review'].includes(existingStatus)) {
      console.log(`[ORDER] Order ${orderId} already ${existingStatus}, skipping`);
      return { success: true, status: existingStatus };
    }

    // If pending or failed with retries left, proceed to retry
    if (['pending', 'failed', 'purchasing'].includes(existingStatus)) {
      const retryCount = existing.data()?.retryCount || 0;
      if (retryCount >= MAX_RETRIES) {
        console.warn(`[ORDER] Order ${orderId} exceeded max retries (${retryCount})`);
        await log(orderId, 'max_retries_exceeded', 'error', `Max retries (${MAX_RETRIES}) exceeded`);

        // Update to manual_review
        await db.collection(COLLECTION_ORDERS).doc(orderId).update({
          status: 'manual_review',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await sendFailureNotification(
          { orderId, retryCount },
          { message: `Max retries exceeded for order ${orderId}. Manual intervention required.` }
        );

        return { success: false, status: 'manual_review', error: 'Max retries exceeded' };
      }

      console.log(`[ORDER] Retrying order ${orderId} (attempt ${retryCount + 1})`);
    }
  }

  // ── Step 1: Fetch order details from Digiseller ──
  let orderInfo;
  try {
    orderInfo = await getOrderInfo(invoiceId);
    if (!orderInfo) {
      throw new Error('Digiseller returned empty order info');
    }
    await log(orderId, 'order_info_fetched', 'info', 'Order details retrieved from Digiseller');
  } catch (err) {
    console.error(`[ORDER] Failed to fetch order info for ${orderId}: ${err.message}`);
    await log(orderId, 'order_info_failed', 'error', err.message);

    // Still create the order record so we can retry
    if (!(await orderExists(orderId))) {
      await db.collection(COLLECTION_ORDERS).doc(orderId).set({
        invoiceId: orderId,
        status: 'pending',
        failureReason: `Failed to fetch order info: ${err.message}`,
        retryCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { success: false, status: 'pending', error: err.message };
  }

  // ── Step 2: Detect language and extract order details ──
  const customerEmail = orderInfo.email || orderInfo.buyer_email || '';
  const digisellerProductId = orderInfo.id_goods || orderInfo.product_id;
  const productName = orderInfo.product_name || orderInfo.name_invoice || 'Unknown Product';
  const lang = detectLanguage(customerEmail, orderInfo);

  // ── Step 3: Look up product mapping ──
  const mapping = await getProductMapping(digisellerProductId);
  if (!mapping) {
    console.error(`[ORDER] No product mapping found for Digiseller product ${digisellerProductId}`);
    await log(orderId, 'no_mapping', 'error', `No mapping for Digiseller product ${digisellerProductId}`);

    // Create/update order as failed
    const orderData = {
      invoiceId: orderId,
      digisellerProductId: Number(digisellerProductId),
      productName,
      customerEmail,
      language: lang,
      status: 'manual_review',
      failureReason: `No product mapping configured for Digiseller product ${digisellerProductId}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection(COLLECTION_ORDERS).doc(orderId).set(orderData, { merge: true });

    await sendFailureNotification(
      { orderId, productId: digisellerProductId, productName },
      { message: `No product mapping found for "${productName}" (ID: ${digisellerProductId}). Configure it in Admin → Mappings.` }
    );

    return { success: false, status: 'manual_review', error: 'No product mapping' };
  }

  // ── Step 4: Create/update order record in Firestore ──
  const existingDoc = await db.collection(COLLECTION_ORDERS).doc(orderId).get();
  const retryCount = existingDoc.exists ? (existingDoc.data()?.retryCount || 0) : 0;

  const orderRecord = {
    invoiceId: orderId,
    digisellerProductId: Number(digisellerProductId),
    canbosoProductId: mapping.canbosoProductId,
    productName,
    customerEmail,
    language: lang,
    status: 'purchasing',
    retryCount: retryCount + (existingDoc.exists ? 1 : 0),
    digisellerChatSent: existingDoc.exists ? (existingDoc.data()?.digisellerChatSent || false) : false,
    deliveryChatSent: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!existingDoc.exists) {
    orderRecord.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await db.collection(COLLECTION_ORDERS).doc(orderId).set(orderRecord, { merge: true });

  // ── Step 5: Send initial contact message (only once) ──
  if (!orderRecord.digisellerChatSent) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://myonlinemail.cfd';
      const deliveryUrl = `${appUrl}/order/${orderId}`;
      const initialMessage = getInitialContactMessage(lang, deliveryUrl);

      const chatSent = await sendChatMessage(invoiceId, initialMessage);

      await db.collection(COLLECTION_ORDERS).doc(orderId).update({
        digisellerChatSent: chatSent,
      });

      if (chatSent) {
        await log(orderId, 'initial_chat_sent', 'info', 'Initial contact message sent to customer');
      } else {
        await log(orderId, 'initial_chat_failed', 'warn', 'Failed to send initial chat message (non-critical)');
      }
    } catch (err) {
      console.error(`[ORDER] Failed to send initial chat for ${orderId}: ${err.message}`);
      await log(orderId, 'initial_chat_error', 'warn', err.message);
      // Non-critical — continue processing
    }
  }

  // ── Step 6: Purchase from Canboso ──
  let purchaseResult;
  try {
    const quantity = mapping.quantity || 1;
    const email = customerEmail || undefined;

    console.log(`[ORDER] Purchasing Canboso product ${mapping.canbosoProductId} (qty: ${quantity}) for order ${orderId}`);
    await log(orderId, 'purchase_attempt', 'info',
      `Attempting purchase: product=${mapping.canbosoProductId}, qty=${quantity}`,
      { canbosoProductId: mapping.canbosoProductId, quantity }
    );

    purchaseResult = await buyProduct(mapping.canbosoProductId, quantity, email);

    if (!purchaseResult || !purchaseResult.success) {
      throw new Error(purchaseResult?.message || 'Purchase returned unsuccessful result');
    }

    console.log(`[ORDER] Purchase successful for ${orderId}: orderCode=${purchaseResult.order?.orderCode}`);
    await log(orderId, 'purchase_success', 'info',
      `Purchase successful: ${purchaseResult.order?.orderCode}`,
      { orderCode: purchaseResult.order?.orderCode, walletBalanceAfter: purchaseResult.order?.settlement?.walletBalanceAfter }
    );

    // Track success for kill-switch
    await trackConsecutiveFailures(true);

    // Check wallet balance warning
    const balanceAfter = purchaseResult.order?.settlement?.walletBalanceAfter;
    if (typeof balanceAfter === 'number') {
      // Store latest known balance
      await db.collection(COLLECTION_SETTINGS).doc('wallet').set({
        lastKnownBalance: balanceAfter,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Alert if balance is low (below 2x the purchase price as threshold)
      const purchaseTotal = purchaseResult.order?.settlement?.totalAmount || 0;
      if (balanceAfter < purchaseTotal * 2 && balanceAfter > 0) {
        await sendBalanceWarning(balanceAfter);
      }

      // KILL SWITCH: Balance hit zero
      if (balanceAfter <= 0) {
        await triggerKillSwitch(
          'Wallet balance has reached ZERO after purchase',
          { orderId, balanceAfter, lastPurchaseAmount: purchaseTotal }
        );
      }
    }

  } catch (err) {
    console.error(`[ORDER] Purchase FAILED for ${orderId}: ${err.message}`);

    // Track failure for kill-switch
    await trackConsecutiveFailures(false);

    // Determine failure type
    const errorCode = err.code || err.errorCode || '';
    const isInsufficientBalance = errorCode === 'INSUFFICIENT_BALANCE' ||
      err.message?.includes('INSUFFICIENT_BALANCE') ||
      err.message?.toLowerCase().includes('insufficient');

    const isOutOfStock = errorCode === 'OUT_OF_STOCK' ||
      err.message?.includes('OUT_OF_STOCK');

    // Update order record
    await db.collection(COLLECTION_ORDERS).doc(orderId).update({
      status: 'failed',
      failureReason: truncate(err.message, 500),
      failureCode: errorCode || 'UNKNOWN',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await log(orderId, 'purchase_failed', 'error', err.message, {
      errorCode,
      isInsufficientBalance,
      isOutOfStock,
      retryCount: orderRecord.retryCount,
    });

    // KILL SWITCH: Insufficient balance
    if (isInsufficientBalance) {
      const currentBalance = err.currentBalance || 0;
      const required = err.required || 0;

      await triggerKillSwitch(
        `Insufficient wallet balance. Need ${required}, have ${currentBalance}`,
        { orderId, currentBalance, required }
      );
    }

    // Send failure message to customer (only once per failure cycle)
    try {
      const failureMessage = getDeliveryFailureMessage(lang);
      await sendChatMessage(invoiceId, failureMessage);
    } catch (chatErr) {
      console.error(`[ORDER] Failed to send failure chat for ${orderId}: ${chatErr.message}`);
    }

    // Notify admin
    await sendFailureNotification(
      { orderId, productName, canbosoProductId: mapping.canbosoProductId },
      { message: err.message, code: errorCode, retryCount: orderRecord.retryCount }
    );

    return { success: false, status: 'failed', error: err.message };
  }

  // ── Step 7: Store delivery data ──
  const items = purchaseResult.items || [];
  const deliveryData = items.length > 0 ? items.map(item => ({
    user: item.user || '',
    password: item.password || '',
    verifyEmail: item.verifyEmail || null,
    expiryText: item.expiryText || null,
    otherInfo: item.otherInfo || null,
  })) : null;

  const isSlotProduct = purchaseResult.productType === 'slot';

  await db.collection(COLLECTION_ORDERS).doc(orderId).update({
    status: isSlotProduct ? 'pending_slot' : 'delivered',
    deliveryData,
    canbosoOrderCode: purchaseResult.order?.orderCode || '',
    walletBalanceAfter: purchaseResult.order?.settlement?.walletBalanceAfter || null,
    productType: purchaseResult.productType,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(isSlotProduct ? {} : { deliveredAt: admin.firestore.FieldValue.serverTimestamp() }),
  });

  // ── Step 8: Deliver to customer via Digiseller chat ──
  if (deliveryData && deliveryData.length > 0) {
    try {
      const deliveryMessage = getDeliverySuccessMessage(lang, deliveryData);
      const chatSent = await sendChatMessage(invoiceId, deliveryMessage);

      await db.collection(COLLECTION_ORDERS).doc(orderId).update({
        deliveryChatSent: chatSent,
      });

      if (chatSent) {
        await log(orderId, 'delivery_chat_sent', 'info', 'Delivery credentials sent via Digiseller chat');
      }
    } catch (err) {
      console.error(`[ORDER] Failed to send delivery chat for ${orderId}: ${err.message}`);
      await log(orderId, 'delivery_chat_failed', 'warn', err.message);
      // Non-critical — customer can still use the web portal
    }
  } else if (isSlotProduct) {
    // Slot product — no items yet, inform customer
    try {
      const slotMessage = lang === 'ru'
        ? '📋 Ваш заказ принят и обрабатывается продавцом. Вы получите товар в ближайшее время. Следите за обновлениями на странице доставки.'
        : '📋 Your order has been received and is being processed by the seller. You will receive your product shortly. Check your delivery page for updates.';
      await sendChatMessage(invoiceId, slotMessage);
    } catch (err) {
      console.error(`[ORDER] Failed to send slot notification for ${orderId}: ${err.message}`);
    }
  }

  // ── Step 9: Notify admin ──
  await sendSuccessNotification({
    orderId,
    productName,
    canbosoOrderCode: purchaseResult.order?.orderCode,
    walletBalanceAfter: purchaseResult.order?.settlement?.walletBalanceAfter,
    itemCount: items.length,
    productType: purchaseResult.productType,
  });

  console.log(`[ORDER] ✅ Order ${orderId} processed successfully`);
  await log(orderId, 'order_completed', 'info', 'Order processed and delivered successfully');

  return { success: true, status: isSlotProduct ? 'pending_slot' : 'delivered' };
}

// ─────────────────────────────────────────────────────────
// Retry Handler (for cron/manual)
// ─────────────────────────────────────────────────────────

/**
 * Retry a specific failed order.
 * @param {string} orderId
 * @returns {Promise<{success: boolean, status: string, error?: string}>}
 */
export async function retryOrder(orderId) {
  console.log(`[RETRY] Retrying order ${orderId}`);
  await log(orderId, 'manual_retry', 'info', 'Manual retry triggered by admin');

  // Reset status to allow reprocessing
  await db.collection(COLLECTION_ORDERS).doc(orderId).update({
    status: 'pending',
    failureReason: null,
    failureCode: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return processNewOrder(orderId);
}

/**
 * Process all pending/failed orders (called by cron).
 * @returns {Promise<{processed: number, succeeded: number, failed: number}>}
 */
export async function processStaleOrders() {
  const results = { processed: 0, succeeded: 0, failed: 0 };

  if (await isEmergencyActive()) {
    console.warn('[CRON] Emergency mode active, skipping stale order processing');
    return results;
  }

  try {
    // Find orders that are stuck in pending/purchasing or failed with retries left
    const staleStatuses = ['pending', 'purchasing', 'failed'];
    const snapshot = await db.collection(COLLECTION_ORDERS)
      .where('status', 'in', staleStatuses)
      .where('retryCount', '<', MAX_RETRIES)
      .orderBy('retryCount', 'asc')
      .orderBy('createdAt', 'asc')
      .limit(10) // Process max 10 per cron run to stay within time limits
      .get();

    if (snapshot.empty) {
      console.log('[CRON] No stale orders to process');
      return results;
    }

    console.log(`[CRON] Found ${snapshot.size} stale orders to process`);

    for (const doc of snapshot.docs) {
      const order = doc.data();
      results.processed++;

      try {
        const result = await processNewOrder(order.invoiceId);
        if (result.success) {
          results.succeeded++;
        } else {
          results.failed++;
        }
      } catch (err) {
        console.error(`[CRON] Error processing order ${doc.id}: ${err.message}`);
        results.failed++;
      }

      // Check emergency between orders
      if (await isEmergencyActive()) {
        console.warn('[CRON] Emergency mode activated during processing, stopping');
        break;
      }
    }
  } catch (err) {
    console.error(`[CRON] Error querying stale orders: ${err.message}`);
  }

  return results;
}

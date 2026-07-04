/**
 * Digiseller Webhook Receiver
 * 
 * POST /api/webhook/digiseller
 * 
 * This endpoint receives webhook callbacks from Digiseller when a payment
 * status changes. It MUST return 200 immediately to prevent Digiseller
 * from marking the webhook as failed.
 * 
 * Processing happens asynchronously via waitUntil() to avoid
 * Vercel's 10-15 second serverless function timeout.
 * 
 * Webhook payload fields:
 *   - invoice_id: Order number
 *   - amount: Payment amount
 *   - currency: USD, RUB, EUR
 *   - status: paid, wait, canceled, refunded, error
 *   - id_goods: Product ID
 *   - signature: Validation hash
 */

import { waitUntil } from '@vercel/functions';
import { db, admin } from '@/lib/firebase';
import { processNewOrder, isEmergencyActive } from '@/lib/order-processor';

/**
 * Validate the incoming webhook request.
 * Digiseller webhooks include a signature for verification.
 * 
 * @param {object} data - Parsed webhook payload
 * @returns {boolean}
 */
function validateWebhook(data) {
  // Basic structural validation
  if (!data) return false;

  // invoice_id is required
  const invoiceId = data.invoice_id || data.invoiceId || data.id_i;
  if (!invoiceId) {
    console.error('[WEBHOOK] Missing invoice_id in payload');
    return false;
  }

  // Digiseller signature validation (if you have a webhook secret configured)
  // For now, we validate the structure and rely on HTTPS + Vercel URL obscurity
  // TODO: Add signature validation when Digiseller webhook secret is configured

  return true;
}

/**
 * Extract the invoice ID from various payload formats.
 * Digiseller may send data in different formats depending on config.
 * 
 * @param {object} data
 * @returns {string|null}
 */
function extractInvoiceId(data) {
  return String(
    data.invoice_id ||
    data.invoiceId ||
    data.id_i ||
    data.inv ||
    ''
  ) || null;
}

/**
 * Extract payment status from webhook payload.
 * @param {object} data
 * @returns {string}
 */
function extractStatus(data) {
  return String(
    data.status ||
    data.pay_status ||
    data.invoice_state ||
    ''
  ).toLowerCase();
}

export async function POST(request) {
  const startTime = Date.now();

  // ── Parse the request body ──
  let data;
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      data = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      data = Object.fromEntries(formData.entries());
    } else {
      // Try JSON first, then form data
      const text = await request.text();
      try {
        data = JSON.parse(text);
      } catch {
        // Try URL-encoded
        const params = new URLSearchParams(text);
        data = Object.fromEntries(params.entries());
      }
    }
  } catch (err) {
    console.error(`[WEBHOOK] Failed to parse request body: ${err.message}`);
    // Still return 200 to prevent Digiseller from retrying with bad data
    return Response.json({ ok: true, message: 'Received but could not parse' }, { status: 200 });
  }

  console.log(`[WEBHOOK] Received webhook:`, JSON.stringify(data).substring(0, 500));

  // ── Validate ──
  if (!validateWebhook(data)) {
    console.error('[WEBHOOK] Invalid webhook payload');
    // Return 200 anyway to prevent retry loops
    return Response.json({ ok: true, message: 'Invalid payload, ignored' }, { status: 200 });
  }

  const invoiceId = extractInvoiceId(data);
  const status = extractStatus(data);

  console.log(`[WEBHOOK] Invoice: ${invoiceId}, Status: ${status}`);

  // ── Only process paid orders ──
  // Digiseller statuses: paid, wait, canceled, refunded, error
  // invoice_state: 1=waiting, 2=paid/completed, 3=confirmed
  const isPaid = status === 'paid' || status === 'completed' ||
    data.invoice_state === 2 || data.invoice_state === '2' ||
    data.invoice_state === 3 || data.invoice_state === '3';

  if (!isPaid) {
    console.log(`[WEBHOOK] Order ${invoiceId} status is "${status}", skipping (not paid)`);
    return Response.json({ ok: true, message: `Status "${status}" — no action needed` }, { status: 200 });
  }

  // ── Check emergency mode ──
  let emergencyActive = false;
  try {
    emergencyActive = await isEmergencyActive();
  } catch {
    // If we can't check, proceed anyway — better to try than miss an order
  }

  if (emergencyActive) {
    console.warn(`[WEBHOOK] Emergency mode active! Saving order ${invoiceId} for later processing`);

    // Still save the order so it can be processed when emergency is cleared
    try {
      const orderRef = db.collection('orders').doc(String(invoiceId));
      const existing = await orderRef.get();
      if (!existing.exists) {
        await orderRef.set({
          invoiceId: String(invoiceId),
          status: 'pending',
          failureReason: 'Received during emergency mode — awaiting admin reset',
          webhookData: JSON.parse(JSON.stringify(data)),
          retryCount: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.error(`[WEBHOOK] Failed to save emergency-mode order: ${err.message}`);
    }

    return Response.json({ ok: true, message: 'Saved for later (emergency mode)' }, { status: 200 });
  }

  // ── CRITICAL: Return 200 immediately, process asynchronously ──
  // Save a minimal record to Firestore first (fast operation)
  try {
    const orderRef = db.collection('orders').doc(String(invoiceId));
    const existing = await orderRef.get();

    if (!existing.exists) {
      await orderRef.set({
        invoiceId: String(invoiceId),
        status: 'pending',
        webhookData: JSON.parse(JSON.stringify(data)),
        digisellerProductId: Number(data.id_goods || data.product_id || 0),
        retryCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[WEBHOOK] Order ${invoiceId} saved to Firestore in ${Date.now() - startTime}ms`);
    } else {
      console.log(`[WEBHOOK] Order ${invoiceId} already exists (status: ${existing.data()?.status})`);
    }
  } catch (err) {
    console.error(`[WEBHOOK] Failed to save order to Firestore: ${err.message}`);
    // Still return 200 — the cron will pick it up via Digiseller polling
  }

  // ── Process asynchronously via waitUntil ──
  // This extends the function lifetime past the response.
  // On Vercel free tier, total execution is still ~10s, but the
  // response goes out immediately so Digiseller sees a fast 200.
  waitUntil(
    processNewOrder(invoiceId).catch(err => {
      console.error(`[WEBHOOK] Async processing failed for ${invoiceId}: ${err.message}`);
      // The cron fallback will retry this order
    })
  );

  const elapsed = Date.now() - startTime;
  console.log(`[WEBHOOK] Responded 200 OK in ${elapsed}ms, processing continues in background`);

  return Response.json({
    ok: true,
    message: 'Order received and processing',
    invoiceId: String(invoiceId),
  }, { status: 200 });
}

/**
 * GET handler — health check for the webhook endpoint.
 */
export async function GET() {
  return Response.json({
    status: 'active',
    endpoint: 'Digiseller Webhook Receiver',
    timestamp: new Date().toISOString(),
  });
}

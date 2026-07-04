/**
 * External Cron — Order Polling Endpoint
 * 
 * GET /api/cron/poll-orders
 * 
 * This endpoint is triggered externally (cron-job.org, local Python script,
 * or any HTTP client) every 60 seconds. It serves two purposes:
 * 
 * 1. POLL: Fetch new orders from Digiseller API that may have been missed
 *    by the webhook (network issues, Digiseller delays, etc.)
 * 2. RETRY: Process any orders stuck in "pending" or "failed" status
 * 
 * Protected by CRON_SECRET Bearer token to prevent unauthorized access.
 */

import { db, admin } from '@/lib/firebase';
import { getNewOrders } from '@/lib/digiseller';
import { processNewOrder, processStaleOrders, isEmergencyActive } from '@/lib/order-processor';
import { sendAdminAlert } from '@/lib/telegram-bot';

/**
 * Validate the authorization header.
 * @param {Request} request
 * @returns {boolean}
 */
function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET not configured — rejecting request');
    return false;
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Also accept as query param for simple external cron services
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token') || url.searchParams.get('secret') || '';

  return token === cronSecret || queryToken === cronSecret;
}

export async function GET(request) {
  const startTime = Date.now();

  // ── Auth check ──
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Emergency check ──
  if (await isEmergencyActive()) {
    console.warn('[CRON] Emergency mode active — skipping all processing');
    return Response.json({
      ok: true,
      emergency: true,
      message: 'Emergency mode active — no processing performed',
    });
  }

  const results = {
    polled: { newOrders: 0, processed: 0 },
    retried: { processed: 0, succeeded: 0, failed: 0 },
    errors: [],
  };

  // ── Phase 1: Poll Digiseller for new orders ──
  try {
    // Get the last poll timestamp from Firestore
    const settingsRef = db.collection('settings').doc('polling');
    const settingsDoc = await settingsRef.get();
    const lastPolledAt = settingsDoc.exists
      ? settingsDoc.data()?.lastPolledAt?.toDate()
      : null;

    // Default to 5 minutes ago if never polled
    const sinceDate = lastPolledAt || new Date(Date.now() - 5 * 60 * 1000);

    console.log(`[CRON] Polling Digiseller for orders since ${sinceDate.toISOString()}`);

    const newOrders = await getNewOrders(sinceDate);
    results.polled.newOrders = newOrders?.length || 0;

    if (newOrders && newOrders.length > 0) {
      console.log(`[CRON] Found ${newOrders.length} orders from Digiseller`);

      for (const order of newOrders) {
        const invoiceId = String(
          order.invoice_id || order.id_i || order.inv || ''
        );

        if (!invoiceId) {
          console.warn('[CRON] Order missing invoice_id, skipping:', order);
          continue;
        }

        // Check if already in Firestore
        const existing = await db.collection('orders').doc(invoiceId).get();
        if (existing.exists && ['delivered', 'manual_review', 'pending_slot'].includes(existing.data()?.status)) {
          continue; // Already handled
        }

        // Process new order
        try {
          await processNewOrder(invoiceId);
          results.polled.processed++;
        } catch (err) {
          console.error(`[CRON] Error processing polled order ${invoiceId}: ${err.message}`);
          results.errors.push({ invoiceId, error: err.message });
        }

        // Check emergency between orders
        if (await isEmergencyActive()) {
          console.warn('[CRON] Emergency activated during polling, stopping');
          break;
        }

        // Respect Vercel timeout — stop if we're approaching 9 seconds
        if (Date.now() - startTime > 8000) {
          console.warn('[CRON] Approaching timeout limit, stopping early');
          break;
        }
      }
    }

    // Update last polled timestamp
    await settingsRef.set({
      lastPolledAt: admin.firestore.FieldValue.serverTimestamp(),
      lastPollResult: {
        newOrders: results.polled.newOrders,
        processed: results.polled.processed,
        timestamp: new Date().toISOString(),
      },
    }, { merge: true });

  } catch (err) {
    console.error(`[CRON] Polling phase error: ${err.message}`);
    results.errors.push({ phase: 'polling', error: err.message });
  }

  // ── Phase 2: Retry stale/failed orders ──
  // Only if we have time left
  if (Date.now() - startTime < 7000) {
    try {
      const retryResults = await processStaleOrders();
      results.retried = retryResults;
    } catch (err) {
      console.error(`[CRON] Retry phase error: ${err.message}`);
      results.errors.push({ phase: 'retry', error: err.message });
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[CRON] Completed in ${elapsed}ms:`, JSON.stringify(results));

  return Response.json({
    ok: true,
    elapsed: `${elapsed}ms`,
    ...results,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST handler — also accept POST for flexibility with external cron services.
 */
export async function POST(request) {
  return GET(request);
}

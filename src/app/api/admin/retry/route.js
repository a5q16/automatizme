/**
 * Admin — Retry Failed Order
 * 
 * POST /api/admin/retry
 * Body: { orderId: string }
 * 
 * Re-triggers the purchase flow for a failed order.
 */

import { isAdminAuthenticated, unauthorizedResponse } from '@/lib/admin-auth';
import { retryOrder } from '@/lib/order-processor';

export async function POST(request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return Response.json({ error: 'orderId is required' }, { status: 400 });
    }

    console.log(`[ADMIN] Retrying order ${orderId}`);
    const result = await retryOrder(String(orderId));

    return Response.json({
      success: result.success,
      status: result.status,
      error: result.error || null,
      message: result.success
        ? `Order ${orderId} reprocessed successfully`
        : `Retry failed: ${result.error}`,
    });
  } catch (err) {
    console.error(`[ADMIN_RETRY] Error: ${err.message}`);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

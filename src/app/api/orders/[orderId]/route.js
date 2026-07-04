/**
 * Order Status API — Public
 * 
 * GET /api/orders/[orderId]
 * 
 * Returns the current status and delivery data for a specific order.
 * This is used by the customer delivery page to display order progress.
 * 
 * SECURITY: Only exposes sanitized, customer-safe data.
 * No internal error messages, Canboso details, or system info.
 */

import { db } from '@/lib/firebase';

export async function GET(request, { params }) {
  try {
    const { orderId } = await params;

    if (!orderId || orderId.length < 3 || orderId.length > 50) {
      return Response.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const doc = await db.collection('orders').doc(String(orderId)).get();

    if (!doc.exists) {
      return Response.json({
        found: false,
        status: 'not_found',
        message: 'Order not found. Please check your order link.',
      }, { status: 404 });
    }

    const order = doc.data();

    // Map internal statuses to customer-friendly statuses
    const customerStatus = mapToCustomerStatus(order.status);

    // Build sanitized response
    const response = {
      found: true,
      orderId: order.invoiceId,
      status: customerStatus.status,
      statusMessage: customerStatus.message,
      productName: order.productName || null,
      language: order.language || 'en',
      createdAt: order.createdAt?.toDate?.()?.toISOString() || null,
      deliveredAt: order.deliveredAt?.toDate?.()?.toISOString() || null,
    };

    // Only include delivery data if order is delivered
    if (order.status === 'delivered' && order.deliveryData) {
      response.deliveryData = order.deliveryData.map(item => ({
        user: item.user || null,
        password: item.password || null,
        verifyEmail: item.verifyEmail || null,
        expiryText: item.expiryText || null,
        otherInfo: item.otherInfo || null,
      }));
    }

    // For slot products, indicate pending seller processing
    if (order.status === 'pending_slot') {
      response.isSlotProduct = true;
    }

    return Response.json(response, {
      status: 200,
      headers: {
        'Cache-Control': order.status === 'delivered' ? 'public, max-age=300' : 'no-cache',
      },
    });

  } catch (err) {
    console.error(`[ORDER_API] Error fetching order: ${err.message}`);
    return Response.json({
      found: false,
      status: 'error',
      message: 'Unable to retrieve order status. Please try again.',
    }, { status: 500 });
  }
}

/**
 * Map internal order status to a customer-friendly status and message.
 * NEVER expose internal error details to customers.
 * 
 * @param {string} internalStatus
 * @returns {{ status: string, message: string }}
 */
function mapToCustomerStatus(internalStatus) {
  switch (internalStatus) {
    case 'pending':
    case 'purchasing':
      return {
        status: 'processing',
        message: 'Your order is being processed automatically. This usually takes less than 2 minutes.',
      };

    case 'delivered':
      return {
        status: 'delivered',
        message: 'Your order has been delivered successfully!',
      };

    case 'pending_slot':
      return {
        status: 'processing',
        message: 'Your order has been received and is being prepared. You will be notified when it is ready.',
      };

    case 'failed':
    case 'manual_review':
      return {
        status: 'delayed',
        message: 'Your order is being reviewed by our team. Your payment is 100% safe. We will deliver your product shortly.',
      };

    default:
      return {
        status: 'processing',
        message: 'Your order is being processed. Please wait a moment.',
      };
  }
}

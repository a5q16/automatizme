/**
 * Admin — Orders List & Emergency Management
 * 
 * GET  /api/admin/orders                   — List all orders with filters
 * POST /api/admin/orders (action: reset)   — Reset emergency kill-switch
 */

import { isAdminAuthenticated, unauthorizedResponse } from '@/lib/admin-auth';
import { db } from '@/lib/firebase';
import { resetEmergency } from '@/lib/order-processor';

export async function GET(request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
    const page = parseInt(url.searchParams.get('page') || '1');

    let query = db.collection('orders').orderBy('createdAt', 'desc');

    if (status && status !== 'all') {
      query = db.collection('orders')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc');
    }

    query = query.limit(limit);

    // Simple offset-based pagination (sufficient for admin views)
    if (page > 1) {
      const skipCount = (page - 1) * limit;
      const skipDocs = await db.collection('orders')
        .orderBy('createdAt', 'desc')
        .limit(skipCount)
        .get();

      if (!skipDocs.empty) {
        const lastDoc = skipDocs.docs[skipDocs.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();

    const orders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        invoiceId: data.invoiceId,
        status: data.status,
        productName: data.productName || 'Unknown',
        digisellerProductId: data.digisellerProductId,
        canbosoProductId: data.canbosoProductId,
        customerEmail: data.customerEmail,
        language: data.language,
        retryCount: data.retryCount || 0,
        failureReason: data.failureReason || null,
        failureCode: data.failureCode || null,
        canbosoOrderCode: data.canbosoOrderCode || null,
        walletBalanceAfter: data.walletBalanceAfter,
        digisellerChatSent: data.digisellerChatSent || false,
        deliveryChatSent: data.deliveryChatSent || false,
        hasDeliveryData: !!(data.deliveryData && data.deliveryData.length > 0),
        productType: data.productType || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        deliveredAt: data.deliveredAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Get total count for pagination
    // Note: Firestore doesn't support efficient COUNT — for admin panels this is acceptable
    const countSnapshot = await db.collection('orders').count().get();
    const total = countSnapshot.data().count;

    return Response.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(`[ADMIN_ORDERS] GET error: ${err.message}`);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  try {
    const { action } = await request.json();

    switch (action) {
      case 'reset_emergency':
        await resetEmergency();
        return Response.json({
          success: true,
          message: 'Emergency kill-switch deactivated. Order processing resumed.',
        });

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error(`[ADMIN_ORDERS] POST error: ${err.message}`);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

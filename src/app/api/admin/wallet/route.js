/**
 * Admin — Wallet Balance Check
 * 
 * GET /api/admin/wallet
 * 
 * Returns the last known Canboso wallet balance from Firestore,
 * and optionally attempts a live check via the API.
 */

export const dynamic = 'force-dynamic';

import { isAdminAuthenticated, unauthorizedResponse } from '@/lib/admin-auth';
import { db } from '@/lib/firebase';
import { listProducts } from '@/lib/canboso';

export async function GET(request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  try {
    // Get last known balance from Firestore
    const walletDoc = await db.collection('settings').doc('wallet').get();
    const lastKnown = walletDoc.exists ? walletDoc.data() : null;

    // Try a live API check by calling list products (it's a lightweight call)
    let apiStatus = 'unknown';
    try {
      const products = await listProducts({ limit: 1 });
      apiStatus = products ? 'connected' : 'error';
    } catch (err) {
      apiStatus = `error: ${err.message}`;
    }

    // Get emergency status
    const emergencyDoc = await db.collection('settings').doc('emergency').get();
    const emergency = emergencyDoc.exists ? emergencyDoc.data() : { active: false };

    // Get failure tracker
    const failureDoc = await db.collection('settings').doc('failure_tracker').get();
    const failures = failureDoc.exists ? failureDoc.data() : { consecutiveFailures: 0 };

    return Response.json({
      wallet: {
        lastKnownBalance: lastKnown?.lastKnownBalance ?? null,
        lastUpdated: lastKnown?.lastUpdated?.toDate?.()?.toISOString() || null,
      },
      apiStatus,
      emergency: {
        active: emergency.active || false,
        reason: emergency.reason || null,
        triggeredAt: emergency.triggeredAt?.toDate?.()?.toISOString() || null,
      },
      consecutiveFailures: failures.consecutiveFailures || 0,
    });
  } catch (err) {
    console.error(`[ADMIN_WALLET] Error: ${err.message}`);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

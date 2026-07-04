/**
 * Admin — Product Mappings CRUD
 * 
 * GET    /api/admin/mappings          — List all mappings
 * POST   /api/admin/mappings          — Create new mapping
 * PUT    /api/admin/mappings?id=xxx   — Update a mapping
 * DELETE /api/admin/mappings?id=xxx   — Delete a mapping
 * 
 * Manages the Digiseller Product → Canboso Product mappings.
 */

export const dynamic = 'force-dynamic';

import { isAdminAuthenticated, unauthorizedResponse } from '@/lib/admin-auth';
import { db, admin } from '@/lib/firebase';

const COLLECTION = 'product_mappings';

export async function GET(request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  try {
    const snapshot = await db.collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();

    const mappings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return Response.json({ success: true, mappings });
  } catch (err) {
    console.error(`[ADMIN_MAPPINGS] GET error: ${err.message}`);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const {
      digisellerProductId,
      digisellerProductName,
      canbosoProductId,
      canbosoProductName,
      quantity = 1,
    } = body;

    // Validation
    if (!digisellerProductId || !canbosoProductId) {
      return Response.json({
        error: 'digisellerProductId and canbosoProductId are required',
      }, { status: 400 });
    }

    // Check for duplicate
    const existing = await db.collection(COLLECTION)
      .where('digisellerProductId', '==', Number(digisellerProductId))
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!existing.empty) {
      return Response.json({
        error: `Active mapping already exists for Digiseller product ${digisellerProductId}`,
        existingId: existing.docs[0].id,
      }, { status: 409 });
    }

    const mapping = {
      digisellerProductId: Number(digisellerProductId),
      digisellerProductName: digisellerProductName || '',
      canbosoProductId: String(canbosoProductId),
      canbosoProductName: canbosoProductName || '',
      quantity: Math.max(1, Math.min(50, Number(quantity) || 1)),
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(COLLECTION).add(mapping);

    console.log(`[ADMIN_MAPPINGS] Created mapping ${docRef.id}: Digiseller ${digisellerProductId} → Canboso ${canbosoProductId}`);

    return Response.json({
      success: true,
      id: docRef.id,
      mapping: { id: docRef.id, ...mapping },
    }, { status: 201 });
  } catch (err) {
    console.error(`[ADMIN_MAPPINGS] POST error: ${err.message}`);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Mapping ID required (?id=xxx)' }, { status: 400 });
    }

    const body = await request.json();
    const updates = {};

    if (body.digisellerProductId !== undefined) updates.digisellerProductId = Number(body.digisellerProductId);
    if (body.digisellerProductName !== undefined) updates.digisellerProductName = body.digisellerProductName;
    if (body.canbosoProductId !== undefined) updates.canbosoProductId = String(body.canbosoProductId);
    if (body.canbosoProductName !== undefined) updates.canbosoProductName = body.canbosoProductName;
    if (body.quantity !== undefined) updates.quantity = Math.max(1, Math.min(50, Number(body.quantity) || 1));
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection(COLLECTION).doc(id).update(updates);

    console.log(`[ADMIN_MAPPINGS] Updated mapping ${id}`);
    return Response.json({ success: true, id, updates });
  } catch (err) {
    console.error(`[ADMIN_MAPPINGS] PUT error: ${err.message}`);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Mapping ID required (?id=xxx)' }, { status: 400 });
    }

    await db.collection(COLLECTION).doc(id).delete();

    console.log(`[ADMIN_MAPPINGS] Deleted mapping ${id}`);
    return Response.json({ success: true, id, message: 'Mapping deleted' });
  } catch (err) {
    console.error(`[ADMIN_MAPPINGS] DELETE error: ${err.message}`);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

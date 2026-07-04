/**
 * Admin Middleware — Shared authentication helper
 * 
 * Validates admin session cookie for protected admin routes.
 */

import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';

/**
 * Validate admin session from request cookies.
 * @returns {Promise<boolean>}
 */
export async function isAdminAuthenticated() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session')?.value;

    if (!session) return false;

    const parts = session.split(':');
    if (parts.length !== 2) return false;

    const [token, hash] = parts;
    const expectedHash = createHash('sha256').update(token).digest('hex');

    return hash === expectedHash;
  } catch {
    return false;
  }
}

/**
 * Return 401 response for unauthenticated requests.
 */
export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized — admin login required' }, { status: 401 });
}

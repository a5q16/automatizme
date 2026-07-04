import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';

export async function isAdminAuthenticated() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session')?.value;

    if (!session) return false;

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return false;

    // Validate the cookie against the deterministic hash of your password
    const expectedToken = createHash('sha256').update(adminPassword + 'digiseller_secure_salt').digest('hex');

    return session === expectedToken;
  } catch {
    return false;
  }
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized — admin login required' }, { status: 401 });
}
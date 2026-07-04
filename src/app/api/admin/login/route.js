import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return Response.json({ error: 'Password required' }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('[ADMIN_LOGIN] ADMIN_PASSWORD not configured');
      return Response.json({ error: 'Admin not configured' }, { status: 500 });
    }

    if (password !== adminPassword) {
      console.warn('[ADMIN_LOGIN] Failed login attempt');
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Create a deterministic secure token based on your actual password
    const sessionToken = createHash('sha256').update(adminPassword + 'digiseller_secure_salt').digest('hex');

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS / 1000,
    });

    console.log('[ADMIN_LOGIN] Admin logged in successfully');
    return Response.json({ success: true, message: 'Logged in' });

  } catch (err) {
    console.error(`[ADMIN_LOGIN] Error: ${err.message}`);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}
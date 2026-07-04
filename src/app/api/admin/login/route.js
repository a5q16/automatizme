/**
 * Admin Login API
 * 
 * POST /api/admin/login
 * 
 * Validates admin password and sets an HTTP-only session cookie.
 */

import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';

// Session tokens stored in memory (Vercel serverless — each instance is short-lived)
// For production with multiple instances, you'd use Firestore sessions
// For a single admin user, this is more than sufficient
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

    // Constant-time comparison to prevent timing attacks
    const inputHash = createHash('sha256').update(password).digest('hex');
    const correctHash = createHash('sha256').update(adminPassword).digest('hex');

    if (inputHash !== correctHash) {
      console.warn('[ADMIN_LOGIN] Failed login attempt');
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Generate session token
    const sessionToken = randomBytes(32).toString('hex');
    const sessionHash = createHash('sha256').update(sessionToken).digest('hex');

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('admin_session', `${sessionToken}:${sessionHash}`, {
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

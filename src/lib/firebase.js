/**
 * @fileoverview Firebase Admin SDK initialization for Firestore.
 *
 * Initializes Firebase Admin using environment variables and exports
 * a Firestore database instance. Uses a singleton pattern to avoid
 * re-initializing on hot-reload during development.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID   - Firebase project identifier
 *   FIREBASE_CLIENT_EMAIL - Service account client email
 *   FIREBASE_PRIVATE_KEY  - Service account private key (PEM format, with escaped newlines)
 */

import admin from 'firebase-admin';

/**
 * Names of the required environment variables for Firebase initialization.
 * @type {string[]}
 */
const REQUIRED_ENV_VARS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

/**
 * Validates that all required Firebase environment variables are present.
 * Throws a descriptive error listing every missing variable so operators
 * can fix all of them in one pass.
 *
 * @throws {Error} If one or more required env vars are missing.
 */
function validateEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(
      `[Firebase] Missing required environment variables: ${missing.join(', ')}. ` +
        'Please set them in your .env.local or hosting environment.'
    );
    return false;
  }
  return true;
}

function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const isValid = validateEnvVars();
  if (!isValid) {
    console.warn('[Firebase] Skipping Admin SDK initialization due to missing env vars (this is normal during build).');
    return null;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });

    console.log(
      `[Firebase] Admin SDK initialized for project "${process.env.FIREBASE_PROJECT_ID}".`
    );

    return app;
  } catch (error) {
    console.error('[Firebase] Failed to initialize Admin SDK:', error.message);
    throw error;
  }
}

// Initialize on module load so dependents can import `db` directly.
const app = initializeFirebase();

/**
 * Firestore database instance.
 * @type {import('firebase-admin').firestore.Firestore}
 */
const db = app ? admin.firestore(app) : null;

/**
 * Firestore FieldValue helper — use for server-side timestamps,
 * array unions, increments, etc.
 *
 * @example
 * const docRef = db.collection('orders').doc(id);
 * await docRef.update({ updatedAt: FieldValue.serverTimestamp() });
 *
 * @type {import('firebase-admin').firestore.FieldValue}
 */
const FieldValue = admin.firestore.FieldValue;

/**
 * Firestore Timestamp class — use for reading / creating explicit timestamps.
 * @type {typeof import('firebase-admin').firestore.Timestamp}
 */
const Timestamp = admin.firestore.Timestamp;

export {
  admin,
  db,
  FieldValue,
  Timestamp,
};

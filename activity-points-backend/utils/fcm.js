/**
 * utils/fcm.js
 *
 * Sends Firebase Cloud Messaging push notifications.
 * Used by tutorRoutes.js when a certificate is approved or rejected.
 *
 * Requires:
 *   - npm install firebase-admin
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to your
 *     serviceAccountKey.json file  (or set FIREBASE_SERVICE_ACCOUNT_JSON
 *     with the raw JSON string for hosted environments like Render)
 */
const admin = require('firebase-admin');

// Initialise once — safe to call multiple times (idempotent)
if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Render / hosted: store the entire JSON as an env var
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccount);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Local dev: path to downloaded serviceAccountKey.json
    credential = admin.credential.applicationDefault();
  } else {
    console.warn('[FCM] No Firebase credentials found — push notifications disabled.');
  }

  if (credential) {
    admin.initializeApp({ credential });
  }
}

/**
 * Send a push notification to a single FCM token.
 *
 * @param {string} fcmToken  - the device token stored on the Student document
 * @param {string} title     - notification title
 * @param {string} body      - notification body
 * @param {object} data      - key/value pairs (all strings) sent as data payload
 */
async function sendPushNotification(fcmToken, title, body, data = {}) {
  if (!admin.apps.length) return;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          channelId: 'certificate_status',
          color:     data.status === 'approved' ? '#16a34a' : '#dc2626',
          priority:  'max',
          sound:     'default',
          // ✅ THIS IS WHAT WAS MISSING — tells Android which activity to open on tap
          clickAction: 'android.intent.action.MAIN',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
  } catch (err) {
    console.error('[FCM] Failed to send push notification:', err.message);
  }
}

module.exports = { sendPushNotification };

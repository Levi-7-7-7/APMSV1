/**
 * utils/fcm.js
 *
 * Sends Firebase Cloud Messaging push notifications — to native app
 * devices (Android/iOS) AND web push subscriptions — with automatic
 * clearing of dead tokens.
 *
 * A Student or Tutor document holds a single token at a time (fcmToken).
 * Registering a token on a new device overwrites whatever was stored
 * before, so only the most recently logged-in device receives pushes
 * for that account — logging in elsewhere effectively "signs out" the
 * previous device from notifications. sendPushToUser() sends to that
 * one token and clears it if Firebase reports it invalid/unregistered.
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
    console.log('[FCM] Firebase Admin initialised OK.');
  }
}

// Error codes Firebase returns for a token that will NEVER work again —
// safe to delete. (Things like 'messaging/internal-error' or
// 'messaging/server-unavailable' are transient and should NOT prune.)
const DEAD_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
  // Token was minted under different Firebase credentials than this
  // server's service account (e.g. an old project, or a build that ran
  // before VITE_FIREBASE_* env vars were correctly set). It can never
  // succeed against these credentials, so it's safe to treat as dead.
  'messaging/mismatched-credential',
]);

/**
 * Build the full cross-platform message payload (minus the token itself).
 * `link` (in data) is used as the URL to open on tap for both web push
 * and native deep-linking.
 */
function buildPayload(title, body, data = {}) {
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  return {
    notification: { title, body },
    data: stringData,
    android: {
      priority: 'high',
      notification: {
        channelId: 'certificate_status',
        color: data.status === 'approved' ? '#16a34a' : '#dc2626',
        priority: 'max',
        sound: 'default',
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
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
      },
      fcmOptions: {
        // Where the browser should navigate on notification click.
        link: data.link || '/',
      },
    },
  };
}

/**
 * Low-level: send one notification to a batch of raw token strings.
 *
 * @returns {{ successCount: number, deadTokens: string[] }}
 *   deadTokens are tokens Firebase confirmed are permanently invalid —
 *   the caller should remove these from the DB.
 */
async function sendToTokens(tokens, title, body, data = {}) {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  if (!admin.apps.length || uniqueTokens.length === 0) {
    return { successCount: 0, deadTokens: [] };
  }

  const message = { ...buildPayload(title, body, data), tokens: uniqueTokens };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    const deadTokens = [];
    response.responses.forEach((r, i) => {
      if (!r.success && DEAD_TOKEN_ERROR_CODES.has(r.error?.code)) {
        deadTokens.push(uniqueTokens[i]);
      }
    });

    if (deadTokens.length) {
      console.warn(`[FCM] Pruning ${deadTokens.length} dead token(s).`);
    }

    return { successCount: response.successCount, deadTokens };
  } catch (err) {
    console.error('[FCM] Multicast send failed:', err.message);
    return { successCount: 0, deadTokens: [] };
  }
}

/**
 * High-level: send a notification to the single device currently
 * registered for a Student or Tutor, and clear the token if Firebase
 * reports it as dead.
 *
 * @param {import('mongoose').Model} Model   - the Student or Tutor model
 * @param {string} userId                    - the document's _id
 * @param {string} title
 * @param {string} body
 * @param {object} data   - string-able key/value pairs, e.g.
 *                          { type: 'new_certificate', certId, status, link }
 */
async function sendPushToUser(Model, userId, title, body, data = {}) {
  if (!admin.apps.length || !userId) return;

  try {
    const user = await Model.findById(userId).select('fcmToken');
    const token = user?.fcmToken?.token;
    if (!token) return;

    const { deadTokens } = await sendToTokens([token], title, body, data);

    if (deadTokens.length) {
      // Only one token to begin with — if it's dead, just clear it.
      await Model.findByIdAndUpdate(userId, {
        $set: { 'fcmToken.token': null },
      });
    }
  } catch (err) {
    console.error('[FCM] sendPushToUser failed:', err.message);
  }
}

/**
 * Register (or refresh) the device token for a Student/Tutor. Called from
 * the `PATCH /fcm-token` routes — typically at login. Overwrites whatever
 * token was previously stored, so only this device receives pushes for
 * the account going forward; if the user was already logged in elsewhere,
 * that other device is implicitly de-registered.
 *
 * @param {import('mongoose').Model} Model
 * @param {string} userId
 * @param {string} token
 * @param {'android'|'ios'|'web'} [platform='android']
 */
async function registerDeviceToken(Model, userId, token, platform = 'android') {
  if (!token) throw new Error('token is required');

  await Model.findByIdAndUpdate(userId, {
    $set: {
      fcmToken: { token, platform, updatedAt: new Date() },
    },
  });
}

/**
 * Legacy single-token sender — kept so any code that still has a bare
 * token string (rather than a Student/Tutor _id) can send without
 * refactoring. Does NOT prune dead tokens (no DB reference to prune from).
 * Prefer sendPushToUser() for anything new.
 */
async function sendPushNotification(fcmToken, title, body, data = {}) {
  if (!fcmToken) return;
  await sendToTokens([fcmToken], title, body, data);
}

module.exports = {
  sendPushNotification,
  sendPushToUser,
  sendToTokens,
  registerDeviceToken,
};

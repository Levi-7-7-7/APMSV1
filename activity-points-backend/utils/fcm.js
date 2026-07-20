/**
 * utils/fcm.js
 *
 * Sends Firebase Cloud Messaging push notifications — to native app
 * devices (Android/iOS) AND web push subscriptions — with multi-device
 * fan-out and automatic pruning of dead tokens.
 *
 * A Student or Tutor document can now hold several tokens at once
 * (fcmTokens[]) — e.g. one phone + one browser tab. sendPushToUser()
 * sends to all of them in a single multicast call and removes any token
 * Firebase reports as invalid/unregistered, so the array never grows
 * stale.
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
 * High-level: send a notification to every device belonging to a
 * Student or Tutor, and auto-prune any tokens Firebase reports as dead.
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
    const user = await Model.findById(userId).select('fcmTokens');
    const tokens = (user?.fcmTokens || []).map((t) => t.token);
    if (tokens.length === 0) return;

    const { deadTokens } = await sendToTokens(tokens, title, body, data);

    if (deadTokens.length) {
      await Model.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { token: { $in: deadTokens } } },
      });
    }
  } catch (err) {
    console.error('[FCM] sendPushToUser failed:', err.message);
  }
}

/**
 * Register (or refresh) a device token for a Student/Tutor. Called from
 * the `PATCH /fcm-token` routes. Dedupes by token string — if the same
 * token is already stored (e.g. the same browser refreshing its
 * subscription), it just bumps `updatedAt` instead of adding a duplicate.
 *
 * @param {import('mongoose').Model} Model
 * @param {string} userId
 * @param {string} token
 * @param {'android'|'ios'|'web'} [platform='android']
 */
async function registerDeviceToken(Model, userId, token, platform = 'android') {
  if (!token) throw new Error('token is required');

  // Remove any existing identical entry, then re-add fresh (dedupe + bump
  // updatedAt in one round trip without a second query).
  await Model.updateOne({ _id: userId }, { $pull: { fcmTokens: { token } } });

  await Model.findByIdAndUpdate(userId, {
    $push: { fcmTokens: { token, platform, updatedAt: new Date() } },
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

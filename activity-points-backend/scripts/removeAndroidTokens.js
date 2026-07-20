/**
 * scripts/removeAndroidTokens.js
 *
 * One-time cleanup: strips every `platform: 'android'` entry out of
 * Student/Tutor `fcmTokens[]`, now that the native Android app is being
 * retired in favour of the web app only. This also happens to remove
 * the known-bad token(s) that were failing with
 * `messaging/mismatched-credential` (the native app's Firebase config
 * never matched the backend's project).
 *
 * Safe to run multiple times — it's just a $pull, no-op if nothing
 * matches.
 *
 * Run once, manually, after you've decided you no longer support the
 * Android app:
 *
 *   node scripts/removeAndroidTokens.js
 *
 * Reads MONGO_URI from your .env, same as the main app.
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function stripAndroidTokens(collection, label) {
  const result = await collection.updateMany(
    { 'fcmTokens.platform': 'android' },
    { $pull: { fcmTokens: { platform: 'android' } } }
  );

  console.log(
    `[${label}] Matched ${result.matchedCount} document(s), modified ${result.modifiedCount}.`
  );
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  await stripAndroidTokens(db.collection('students'), 'students');
  await stripAndroidTokens(db.collection('tutors'), 'tutors');

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

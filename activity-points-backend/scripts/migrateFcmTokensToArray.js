/**
 * scripts/migrateFcmTokensToArray.js
 *
 * One-time migration: moves the old single `fcmToken` string field
 * (Student/Tutor) into the new `fcmTokens` array field, so existing
 * logged-in devices keep receiving push notifications after the
 * multi-device upgrade ships.
 *
 * Safe to run multiple times — skips documents that have no legacy
 * fcmToken, or that already have a matching token in fcmTokens.
 *
 * Run once, manually, right after deploying the fcmTokens array change:
 *
 *   node scripts/migrateFcmTokensToArray.js
 *
 * Reads MONGO_URI from your .env, same as the main app. Talks to the raw
 * collections (not the Mongoose models) so it can still see the old
 * `fcmToken` field even though it's no longer declared in the schema.
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function migrateCollection(collection, label) {
  const cursor = collection.find({
    fcmToken: { $exists: true, $ne: null },
  });

  let migrated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const legacyToken = doc.fcmToken;
    const existing = Array.isArray(doc.fcmTokens) ? doc.fcmTokens : [];

    const alreadyThere = existing.some((t) => t.token === legacyToken);
    if (alreadyThere) {
      await collection.updateOne({ _id: doc._id }, { $unset: { fcmToken: '' } });
      skipped++;
      continue;
    }

    await collection.updateOne(
      { _id: doc._id },
      {
        $push: {
          fcmTokens: {
            token: legacyToken,
            // Pre-migration tokens all came from the native app.
            platform: 'android',
            updatedAt: new Date(),
          },
        },
        $unset: { fcmToken: '' },
      }
    );
    migrated++;
  }

  console.log(`✅ ${label}: migrated ${migrated}, skipped ${skipped} (already present)`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  await migrateCollection(mongoose.connection.collection('students'), 'Students');
  await migrateCollection(mongoose.connection.collection('tutors'), 'Tutors');

  await mongoose.disconnect();
  console.log('✅ Done. All legacy fcmToken values moved into fcmTokens[].');
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

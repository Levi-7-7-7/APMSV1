/**
 * scripts/backfillFirstTimePasswordSet.js
 *
 * One-time migration: marks every EXISTING student and tutor account as
 * having already completed the "first time password set" step, so the new
 * dashboard popup only nags accounts created AFTER this feature ships —
 * not your current active users who are already using passwords they
 * (or an admin) already chose.
 *
 * Run once, manually, before/after deploying the firstTimePasswordSet
 * feature:
 *
 *   node scripts/backfillFirstTimePasswordSet.js
 *
 * Safe to run multiple times (it's just a bulk field set). Reads MONGO_URI
 * from your .env, same as the main app.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Tutor = require('../models/Tutor');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  // Only touch documents that don't already have the field explicitly set
  // to false-by-choice — in practice, right after this ships, that's every
  // pre-existing doc (the field doesn't exist on them yet at all).
  const studentResult = await Student.updateMany(
    { firstTimePasswordSet: { $ne: true } },
    { $set: { firstTimePasswordSet: true } }
  );
  const tutorResult = await Tutor.updateMany(
    { firstTimePasswordSet: { $ne: true } },
    { $set: { firstTimePasswordSet: true } }
  );

  console.log(`✅ Students updated: ${studentResult.modifiedCount}`);
  console.log(`✅ Tutors updated:   ${tutorResult.modifiedCount}`);

  await mongoose.disconnect();
  console.log('✅ Done. Only students/tutors created from now on will see the password-setup popup.');
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

/**
 * createAdmin.js
 * ─────────────────────────────────────────────────────────
 * Break-glass script to create (or recover) the admin account for your
 * college, run directly against the database — no HTTP endpoint involved.
 *
 * Use this when the Admin collection is empty and you need to bootstrap
 * access again (e.g. every admin account was deleted). If at least one
 * admin still exists, prefer logging in as them and creating new admins
 * through POST /api/admin/auth/register instead, which requires an admin
 * token once any admin exists.
 *
 * Credentials are NEVER hardcoded here — pass them as environment
 * variables (recommended) or CLI args so nothing sensitive ends up
 * committed to source control.
 *
 * Usage:
 *   ADMIN_EMAIL=you@college.edu ADMIN_PASSWORD='choose-a-strong-one' node createAdmin.js
 *
 *   # or
 *   node createAdmin.js you@college.edu 'choose-a-strong-one'
 *
 * Make sure your .env file is set up with MONGO_URI before running this.
 * ─────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || process.argv[2];
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.argv[3];

async function createAdmin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Missing credentials.\n');
    console.error('   Usage:');
    console.error("     ADMIN_EMAIL=you@college.edu ADMIN_PASSWORD='strong-password' node createAdmin.js");
    console.error('   or:');
    console.error("     node createAdmin.js you@college.edu 'strong-password'\n");
    process.exit(1);
  }

  if (ADMIN_PASSWORD.length < 8) {
    console.error('❌ Password must be at least 8 characters.');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const existing = await Admin.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log(`⚠️  An admin with email "${ADMIN_EMAIL}" already exists.`);
      console.log('   If you want to reset the password, delete the existing admin from the DB first.');
      process.exit(0);
    }

    const admin = await Admin.create({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,  // the model auto-hashes this via bcrypt pre-save hook
    });

    console.log('🎉 Admin account created successfully!');
    console.log('─────────────────────────────────────');
    console.log(`   Email : ${admin.email}`);
    console.log(`   ID    : ${admin._id}`);
    console.log('─────────────────────────────────────');
    console.log('\n✅ You can now log in at /admin/login (or select Admin on the main login page)');
    console.log('⚠️  The password you passed in was never written to disk by this script — keep it somewhere safe (e.g. a password manager) now.\n');

  } catch (err) {
    console.error('❌ Error creating admin:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();

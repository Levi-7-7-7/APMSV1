/**
 * createAdmin.js
 * ─────────────────────────────────────────────────────────
 * One-time script to create the admin account for your college.
 *
 * Usage:
 *   node createAdmin.js
 *
 * Make sure your .env file is set up with MONGO_URI and JWT_SECRET
 * before running this.
 * ─────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

// ─── CONFIGURE YOUR ADMIN CREDENTIALS HERE ───────────────
const ADMIN_EMAIL    = 'lijot707@gmail.com';   // ← change this
const ADMIN_PASSWORD = 'mtitsr123';      // ← change this (min 8 chars)
// ─────────────────────────────────────────────────────────

async function createAdmin() {
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
    console.log(`   Email    : ${admin.email}`);
    console.log(`   Password : ${ADMIN_PASSWORD}  ← save this somewhere safe`);
    console.log(`   ID       : ${admin._id}`);
    console.log('─────────────────────────────────────');
    console.log('\n✅ You can now log in at /admin/login (or select Admin on the main login page)');
    console.log('⚠️  Delete or disable this script after use.\n');

  } catch (err) {
    console.error('❌ Error creating admin:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();

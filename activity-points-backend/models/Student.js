/**
 * models/Student.js
 *
 * Added fields:
 *   profilePhoto       — full ImageKit URL of the student's profile photo
 *   profilePhotoFileId — ImageKit fileId used to delete the old photo on re-upload
 *
 * Account creation:
 *   Students are created by an admin or tutor with a cryptographically random
 *   password. The password is sent once in the welcome email and can be changed
 *   later through the Reset / Forgot Password flow.
 */

const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  registerNumber: { type: String, required: true, unique: true },
  email:          { type: String, required: true, unique: true },
  password:       { type: String, required: true },

  batch:  { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  // Set explicitly by the tutor when adding the student (single-add or CSV)
  isLateralEntry: { type: Boolean, default: false },

  resetPasswordToken:   { type: String, default: null },
  resetPasswordExpires: { type: Date,   default: null },

  // Retained for compatibility with existing data. New accounts receive a
  // random password and are not forced to change it on first login. The flag
  // becomes true after the student changes/resets their password.
  firstTimePasswordSet: { type: Boolean, default: false },

  totalPoints: { type: Number, default: 0 },

  // ── Push notification device token (single-device) ────────────────────────
  // Only one token is kept per student. Logging in (or re-registering for
  // push) on a new device overwrites this field, so the previous device
  // stops receiving notifications for this account — only the most
  // recently logged-in device gets pushes at any given time.
  // `platform` lets sendPushNotification pick the right payload shape
  // (webpush vs android/apns).
  fcmToken: {
    token:     { type: String, default: null },
    platform:  { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    updatedAt: { type: Date, default: null },
  },

  // ── Profile photo (stored on ImageKit) ───────────────────────────────────
  // Full public URL returned by ImageKit, e.g.:
  //   "https://ik.imagekit.io/<your-id>/profiles/profile_<id>_<ts>.jpg"
  // null = no photo uploaded yet (app shows initials fallback)
  profilePhoto: { type: String, default: null },

  // ImageKit fileId — stored so we can delete the old file when a new one
  // is uploaded (avoids orphaned files accumulating in your IK media library)
  profilePhotoFileId: { type: String, default: null },

}, { timestamps: true });

module.exports = mongoose.model('Student', StudentSchema);

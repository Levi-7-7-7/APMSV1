/**
 * models/Student.js
 *
 * Added fields:
 *   profilePhoto       — full ImageKit URL of the student's profile photo
 *   profilePhotoFileId — ImageKit fileId used to delete the old photo on re-upload
 *
 * Account creation model (no more OTP-based first-time login):
 *   Students are created by a tutor (single-add or CSV) with a default
 *   password of firstName + "12345". They log in immediately with
 *   registerNumber + that password, and can change it any time via the
 *   "Reset / Forgot Password" flow.
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

  // Security flag: every student account starts with a predictable default
  // password (firstName + "12345"), so we prompt them to change it the
  // moment they land on the dashboard after login. Flips to true the first
  // time they successfully complete the "Reset / Forgot Password" flow —
  // after that the dashboard popup never shows again.
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

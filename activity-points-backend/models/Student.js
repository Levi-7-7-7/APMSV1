/**
 * models/Student.js
 *
 * Added fields:
 *   profilePhoto       — full ImageKit URL of the student's profile photo
 *   profilePhotoFileId — ImageKit fileId used to delete the old photo on re-upload
 */

const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  registerNumber: { type: String, required: true, unique: true },
  email:          { type: String, required: true, unique: true },
  password:       { type: String },

  batch:  { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  isLateralEntry: { type: Boolean, default: false },

  firstLoginCompleted: { type: Boolean, default: false },
  isVerified:          { type: Boolean, default: false },

  otp:       { type: String, default: null },
  otpExpiry: { type: Date,   default: null },

  resetPasswordToken:   { type: String, default: null },
  resetPasswordExpires: { type: Date,   default: null },

  totalPoints: { type: Number, default: 0 },

  fcmToken: { type: String, default: null },

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

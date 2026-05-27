/**
 * models/Student.js  (updated — adds profilePhoto field)
 *
 * Only change: added `profilePhoto` field.
 * Everything else is identical to the original.
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

  // ── NEW ──────────────────────────────────────────────────────────────────
  // Relative URL of the student's uploaded profile photo.
  // e.g. "/uploads/profiles/student_<id>_<ts>.jpg"
  // null = no photo uploaded yet (app shows initials fallback)
  profilePhoto: { type: String, default: null },

}, { timestamps: true });

module.exports = mongoose.model('Student', StudentSchema);

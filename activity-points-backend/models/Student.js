const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  registerNumber: { type: String, required: true, unique: true },
  email:          { type: String, required: true, unique: true },
  password:       { type: String },

  batch:  { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

  // Set to true when student is a lateral entry (3-year course) — requires only 40 pts instead of 60
  isLateralEntry: { type: Boolean, default: false },

  // First-time login flow
  firstLoginCompleted: { type: Boolean, default: false },
  isVerified:          { type: Boolean, default: false },

  // OTP fields (cleared after use)
  otp:       { type: String, default: null },
  otpExpiry: { type: Date,   default: null },

  // Password reset fields (cleared after use)
  resetPasswordToken:   { type: String, default: null },
  resetPasswordExpires: { type: Date,   default: null },

  // Stored total — kept in sync when certificates are approved/rejected
  // Note: the tutor dashboard recalculates this live with capping rules for display
  totalPoints: { type: Number, default: 0 },

}, { timestamps: true });

module.exports = mongoose.model('Student', StudentSchema);

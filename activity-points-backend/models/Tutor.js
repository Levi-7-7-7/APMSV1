const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const tutorSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  batch:    { type: mongoose.Schema.Types.ObjectId, ref: 'Batch',  default: null },
  branch:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },

  // Password reset via OTP (mirrors Student model)
  resetPasswordToken:   { type: String,  default: null },
  resetPasswordExpires: { type: Number,  default: null },

  // FCM device token for push notifications (new certificate uploaded alerts)
  fcmToken: { type: String, default: null },

  // ── Profile photo (stored on ImageKit) ───────────────────────
  profilePhoto:       { type: String, default: null },
  profilePhotoFileId: { type: String, default: null },
}, { timestamps: true });

tutorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('Tutor', tutorSchema);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePhoto: { type: String, default: null },
  profilePhotoFileId: { type: String, default: null },

  // Web/native push token for this admin's device — mirrors Student/Tutor
  // (see those models). Admin has no batch/branch scoping, so unlike
  // Student/Tutor pushes (sent to one specific person), admin-facing
  // pushes go out to every Admin account that has a token on file — see
  // sendPushToAdmins() in utils/fcm.js.
  fcmToken: {
    token:     { type: String, default: null },
    platform:  { type: String, enum: ['android', 'ios', 'web'], default: 'web' },
    updatedAt: { type: Date, default: null },
  },


  // Password reset via OTP (mirrors Student/Tutor models)
  resetPasswordToken:   { type: String, default: null },
  resetPasswordExpires: { type: Number, default: null },
});

// hash password
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model("Admin", adminSchema);

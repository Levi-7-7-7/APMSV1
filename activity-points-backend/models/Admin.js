const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePhoto: { type: String, default: null },
  profilePhotoFileId: { type: String, default: null },

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

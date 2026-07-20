const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const Admin = require("../models/Admin");
const adminAuth = require("../middleware/adminAuth");
const logActivity = require("../utils/activityLog");
const imagekit = require("../utils/imagekit");
const SibApiV3Sdk = require("sib-api-v3-sdk");

const router = express.Router();

// Memory-storage upload for profile photos (same pattern as tutor routes)
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ─── BREVO EMAIL CLIENT (same pattern as student/tutor reset flows) ──────────
const brevoClient = SibApiV3Sdk.ApiClient.instance;
brevoClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendAdminResetOTPEmail(toEmail, otp) {
  await emailApi.sendTransacEmail({
    sender: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME || "Activity Points System",
    },
    to: [{ email: toEmail }],
    subject: "Password Reset OTP - Activity Points System",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #1e3a8a; margin-bottom: 8px;">Password Reset</h2>
        <p style="color: #374151;">Hi Admin,</p>
        <p style="color: #374151;">Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
        <div style="background: #eff6ff; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1e3a8a;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If you did not request this, please ignore this email. Your password will remain unchanged.</p>
      </div>
    `,
  });
}

// ─── FORGOT PASSWORD — send OTP to the admin's registered email ─────────────
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) return res.status(400).json({ message: "Email is required" });

    const admin = await Admin.findOne({ email: email.trim().toLowerCase() });
    if (!admin) return res.status(404).json({ message: "No admin account found with that email" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    admin.resetPasswordToken = otp;
    admin.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await admin.save();

    await sendAdminResetOTPEmail(admin.email, otp);

    const masked = admin.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + "*".repeat(b.length) + c);
    res.json({ message: "OTP sent to your registered email", maskedEmail: masked });
  } catch (err) {
    console.error("Admin forgot-password error:", err.response?.body || err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ─── RESET PASSWORD — verify OTP and set new password ───────────────────────
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const admin = await Admin.findOne({
      email: email.trim().toLowerCase(),
      resetPasswordToken: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!admin) return res.status(400).json({ message: "Invalid or expired OTP" });

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    admin.password = newPassword; // pre-save hook hashes it
    admin.resetPasswordToken = null;
    admin.resetPasswordExpires = null;
    await admin.save();

    logActivity({
      req,
      actorType: "admin",
      actorId: admin._id,
      actorEmail: admin.email,
      action: "admin_password_reset",
      description: `Admin ${admin.email} reset their password`,
      targetType: "Admin",
      targetId: admin._id,
      targetName: admin.email,
    });

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error("Admin reset-password error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// Admin Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    logActivity({
      req,
      actorType: 'admin',
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'admin_login',
      description: `Admin ${admin.email} logged in`,
      targetType: 'Admin',
      targetId: admin._id,
      targetName: admin.email,
    });

    res.json({ success: true, token, email: admin.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get the logged-in admin's own profile (email + photo)
router.get("/me", adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("email profilePhoto");
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    res.json({ success: true, admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload / update the logged-in admin's own profile photo
router.patch("/profile-photo", adminAuth, photoUpload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No photo file provided" });

    const admin = await Admin.findById(req.admin.id).select("email profilePhoto profilePhotoFileId");
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    // Delete old image from ImageKit if it exists
    if (admin.profilePhotoFileId) {
      try { await imagekit.deleteFile(admin.profilePhotoFileId); } catch (_) {}
    }

    const extension = path.extname(req.file.originalname) || ".jpg";
    const fileName = `admin_${req.admin.id}_${Date.now()}${extension}`;

    const uploadResponse = await imagekit.upload({
      file: req.file.buffer,
      fileName,
      folder: "/admin-profiles",
      useUniqueFileName: false,
    });

    admin.profilePhoto = uploadResponse.url;
    admin.profilePhotoFileId = uploadResponse.fileId;
    await admin.save();

    logActivity({
      req,
      actorType: "admin",
      actorId: req.admin.id,
      actorEmail: admin.email,
      action: "admin_profile_photo_updated",
      description: `${admin.email} updated their profile photo`,
      targetType: "Admin",
      targetId: admin._id,
      targetName: admin.email,
    });

    res.json({ success: true, profilePhoto: uploadResponse.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Profile photo upload failed" });
  }
});

// Register Admin
//
// Bootstrap-only: this is ONLY allowed with no auth when the Admin
// collection is completely empty (fresh install, or recovering after every
// admin account was deleted). As soon as one admin exists, creating another
// one requires a valid admin token — so this can never be used by a random
// visitor to mint themselves an admin account on a live system.
//
// Recovering when the Admin collection is empty AND you have no way to
// reach this endpoint (e.g. it's also locked behind something upstream)?
// Use `node createAdmin.js` directly against the database instead — see
// that file for usage.
router.post("/register", async (req, res) => {
  try {
    const adminCount = await Admin.countDocuments();

    if (adminCount > 0) {
      // Admins already exist — only an existing admin can create another.
      return adminAuth(req, res, async () => {
        const { email, password } = req.body;
        const exists = await Admin.findOne({ email });
        if (exists) return res.status(400).json({ error: "Admin already exists" });
        const admin = await Admin.create({ email, password });

        logActivity({
          req,
          actorType: 'admin',
          actorId: req.admin?.id,
          actorEmail: req.admin?.email,
          action: 'admin_created',
          description: `Admin created a new admin account (${email})`,
          targetType: 'Admin',
          targetId: admin._id,
          targetName: email,
        });

        res.json({ success: true, message: "Admin created", id: admin._id });
      });
    }

    // No admins exist yet — allow one unauthenticated bootstrap registration.
    const { email, password } = req.body;
    const admin = await Admin.create({ email, password });

    logActivity({
      req,
      actorType: 'system',
      action: 'admin_created',
      description: `First admin account created (${email}) via bootstrap registration`,
      targetType: 'Admin',
      targetId: admin._id,
      targetName: email,
    });

    res.json({ success: true, message: "First admin account created", id: admin._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List all admins (id + email + photo only — never the password hash)
router.get("/admins", adminAuth, async (req, res) => {
  try {
    const admins = await Admin.find().select("email profilePhoto").sort({ email: 1 });
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an admin.
// Safety guard: never allow the very last admin account to be deleted —
// that would lock everyone out of admin access entirely (the only way back
// in at that point is the createAdmin.js CLI script).
router.delete("/admins/:id", adminAuth, async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count <= 1) {
      return res.status(400).json({ error: "Can't delete the last remaining admin account." });
    }
    const deleted = await Admin.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Admin not found" });

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'admin_deleted',
      description: `Admin ${req.admin?.email || req.admin?.id} deleted admin account (${deleted.email})`,
      targetType: 'Admin',
      targetId: deleted._id,
      targetName: deleted.email,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

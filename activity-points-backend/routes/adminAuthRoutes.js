const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const adminAuth = require("../middleware/adminAuth");
const logActivity = require("../utils/activityLog");

const router = express.Router();

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

// List all admins (id + email only — never the password hash)
router.get("/admins", adminAuth, async (req, res) => {
  try {
    const admins = await Admin.find().select("email").sort({ email: 1 });
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

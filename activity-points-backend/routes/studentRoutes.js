

const Batch = require('../models/Batch');
const Branch = require('../models/Branch');
/**
 * routes/studentRoutes.js  (updated)
 *
 * Added: PATCH /api/students/fcm-token
 *   Called by the native app after obtaining a Firebase token.
 *   Saves it on the Student document so tutorRoutes can use it
 *   when sending approve/reject push notifications.
 */
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Student = require('../models/Student');


// Get dropdown lists for batch & branch
router.get('/dropdown-data', async (req, res) => {
  try {
    const batches = await Batch.find();
    const branches = await Branch.find();
    res.json({ batches, branches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Existing route ────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .populate('batch',  'name')
      .populate('branch', 'name')
      .select('-password -otp -otpExpiry -resetPasswordToken -resetPasswordExpires');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── NEW: Register / refresh FCM device token ──────────────────────────────────
// PATCH /api/students/fcm-token
// Body: { fcmToken: "..." }
// Called from the native app on every launch (token can rotate).
router.patch('/fcm-token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({ error: 'fcmToken is required' });
    }

    await Student.findByIdAndUpdate(req.user.id, { fcmToken });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const sendOTPEmail = require('../utils/sendOTPEmail');
const { requestPasswordReset, resetPassword } = require('../controllers/authController');

const router = express.Router();

// Step 1: First-time student — send OTP to registered email
router.post('/start-login', async (req, res) => {
  const { registerNumber } = req.body;
  try {
    const student = await Student.findOne({ registerNumber });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    student.otp = otp;
    student.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    await student.save();

    await sendOTPEmail(student.email, otp);
    res.json({ message: 'OTP sent to your registered email', firstLoginCompleted: student.firstLoginCompleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Verify OTP and set password (first-time login only)
router.post('/verify-otp', async (req, res) => {
  const { registerNumber, otp, password, batch, branch, isLateralEntry } = req.body;
  try {
    const student = await Student.findOne({ registerNumber });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    if (student.otp !== otp || student.otpExpiry < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    student.password = await bcrypt.hash(password, 10);
    if (batch) student.batch = batch;
    if (branch) student.branch = branch;
    if (typeof isLateralEntry === "boolean") student.isLateralEntry = isLateralEntry;
    student.isVerified = true;
    student.firstLoginCompleted = true;
    student.otp = null;
    student.otpExpiry = null;
    await student.save();

    const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Account verified. Login successful.', token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 3: Normal student login (after first-time setup)
router.post('/login', async (req, res) => {
  const { registerNumber, password } = req.body;
  try {
    const student = await Student.findOne({ registerNumber });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (!student.isVerified) return res.status(400).json({ error: 'Please complete your first-time setup first' });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, student: { name: student.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Forgot password — sends reset link to student's email
router.post('/forgot-password', requestPasswordReset);

// Reset password using token from email
router.post('/reset-password', resetPassword);

module.exports = router;

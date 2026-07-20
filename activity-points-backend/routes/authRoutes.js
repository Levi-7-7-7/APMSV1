const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const { requestPasswordReset, resetPassword } = require('../controllers/authController');
const logActivity = require('../utils/activityLog');

const router = express.Router();

// Student login — register number + password.
// Every student account has a password from the moment it's created by a
// tutor (default: firstName + "12345"), so there's no separate
// first-time-setup step. Students who don't know/remember their password
// use "Reset / Forgot Password" (below) at any time.
router.post('/login', async (req, res) => {
  const { registerNumber, password } = req.body;
  try {
    const student = await Student.findOne({ registerNumber });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    logActivity({
      req,
      actorType: 'student',
      actorId: student._id,
      actorName: student.name,
      actorEmail: student.email,
      action: 'student_login',
      description: `${student.name} (${student.registerNumber}) logged in`,
      targetType: 'Student',
      targetId: student._id,
      targetName: student.name,
    });

    res.json({
      message: 'Login successful',
      token,
      student: {
        name: student.name,
        firstTimePasswordSet: student.firstTimePasswordSet,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset / Forgot password — sends an OTP to the student's registered email
router.post('/forgot-password', requestPasswordReset);

// Verify OTP and set a new password
router.post('/reset-password', resetPassword);

module.exports = router;

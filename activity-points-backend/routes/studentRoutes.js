const express = require('express');
const Student = require('../models/Student');
const Batch = require('../models/Batch');
const Branch = require('../models/Branch');
const auth = require('../middleware/auth');

const router = express.Router();

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

// Get logged-in student profile
router.get('/me', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .populate('batch')
      .populate('branch')
      .select('-password -otp -otpExpiry');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

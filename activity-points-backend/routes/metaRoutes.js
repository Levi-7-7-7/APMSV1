// routes/metaRoutes.js
const express = require('express');
const Batch = require('../models/Batch');
const Branch = require('../models/Branch');
const tutorAuth = require('../middleware/tutorAuth');

const router = express.Router();

// Get all batches (protected)
router.get('/batches', tutorAuth, async (req, res) => {
  try {
    const batches = await Batch.find();
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all branches (protected)
router.get('/branches', tutorAuth, async (req, res) => {
  try {
    const branches = await Branch.find();
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

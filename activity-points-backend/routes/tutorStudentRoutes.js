// This file is intentionally kept minimal.
// All student-related tutor routes are handled in tutorRoutes.js under /tutors/students/*
// This router is mounted at /api/tutor/students and provides the CSV upload endpoint
// to keep backward compatibility with older frontend calls.

const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const Student = require('../models/Student');
const tutorAuth = require('../middleware/tutorAuth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// POST /api/tutor/students/upload — bulk upload students via CSV
// CSV format: name, registerNumber, email
router.post('/upload', tutorAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const studentsToInsert = results.map(s => ({
          name: s.name,
          registerNumber: s.registerNumber,
          email: s.email,
          firstLoginCompleted: false,
          isVerified: false,
        }));

        const inserted = await Student.insertMany(studentsToInsert, { ordered: false });
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ message: `${inserted.length} students uploaded successfully` });
      } catch (err) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(400).json({ error: err.message });
      }
    });
});

module.exports = router;

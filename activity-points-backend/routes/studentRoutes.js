/**
 * studentRoutes.js  (updated — adds profile photo upload)
 *
 * New endpoint:
 *   PATCH /api/students/profile-photo
 *   Accepts multipart/form-data with field "photo" (image file)
 *   Stores the file on disk (uploads/profiles/) via multer
 *   Saves the relative URL on the Student document as `profilePhoto`
 *   Returns { profilePhoto: "/uploads/profiles/<filename>" }
 *
 * Also adds static file serving — add this line in index.js:
 *   app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
 *
 * No new npm packages needed — multer is a standard Express dependency.
 * Run:  npm install multer
 */

const path    = require('path');
const fs      = require('fs');
const express = require('express');
const multer  = require('multer');
const Batch   = require('../models/Batch');
const Branch  = require('../models/Branch');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Student = require('../models/Student');

// ── multer setup ──────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'profiles');

// Create upload directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, _file, cb) => {
    // Use student ID + timestamp so filenames are unique and deterministic
    const ext = '.jpg';
    cb(null, `student_${req.user.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ── existing routes (unchanged) ───────────────────────────────────────────────

// Get dropdown lists for batch & branch
router.get('/dropdown-data', async (req, res) => {
  try {
    const batches  = await Batch.find();
    const branches = await Branch.find();
    res.json({ batches, branches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .populate('batch',  'name')
      .populate('branch', 'name')
      .select('-password -otp -otpExpiry -resetPasswordToken -resetPasswordExpires');
    if (!student) { return res.status(404).json({ error: 'Student not found' }); }
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// ── NEW: profile photo upload ─────────────────────────────────────────────────

// PATCH /api/students/profile-photo
// Body: multipart/form-data, field "photo"
router.patch(
  '/profile-photo',
  auth,
  upload.single('photo'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No photo file provided' });
      }

      // Build the relative URL that the app will use to display the photo
      const profilePhoto = `/uploads/profiles/${req.file.filename}`;

      // Delete old photo from disk if there was one
      const student = await Student.findById(req.user.id).select('profilePhoto');
      if (student?.profilePhoto) {
        const oldPath = path.join(__dirname, '..', student.profilePhoto);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      await Student.findByIdAndUpdate(req.user.id, { profilePhoto });

      res.json({ success: true, profilePhoto });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;

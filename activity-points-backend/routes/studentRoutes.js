/**
 * routes/studentRoutes.js
 *
 * ImageKit-based profile photo upload
 * -----------------------------------
 * Requirements:
 *
 * npm install multer imagekit
 *
 * ENV VARIABLES:
 *
 * IMAGEKIT_PUBLIC_KEY=xxxxx
 * IMAGEKIT_PRIVATE_KEY=xxxxx
 * IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
 *
 * IMPORTANT:
 * Remove ALL old local-upload logic.
 * No /uploads folder needed anymore.
 * No express.static('/uploads') needed anymore.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ImageKit = require('imagekit');

const Batch = require('../models/Batch');
const Branch = require('../models/Branch');
const Student = require('../models/Student');
const { buildStudentCertFolder } = require('../utils/imagekitPaths');

const auth = require('../middleware/auth');
const Tutor = require('../models/Tutor');
const logActivity = require('../utils/activityLog');

const router = express.Router();

/* ────────────────────────────────────────────────────────────
 * IMAGEKIT CONFIG
 * ──────────────────────────────────────────────────────────── */

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

/* ────────────────────────────────────────────────────────────
 * MULTER (MEMORY STORAGE)
 * ──────────────────────────────────────────────────────────── */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },

  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/* ────────────────────────────────────────────────────────────
 * DROPDOWN DATA
 * ──────────────────────────────────────────────────────────── */

router.get('/dropdown-data', async (_req, res) => {
  try {
    const batches = await Batch.find();
    const branches = await Branch.find();

    res.json({
      batches,
      branches,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET CURRENT STUDENT
 * ──────────────────────────────────────────────────────────── */

router.get('/me', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id)
      .populate('batch', 'name')
      .populate('branch', 'name')
      .select(
        '-password -resetPasswordToken -resetPasswordExpires',
      );

    if (!student) {
      return res.status(404).json({
        error: 'Student not found',
      });
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

/* ────────────────────────────────────────────────────────────
 * UPDATE FCM TOKEN
 * ──────────────────────────────────────────────────────────── */

router.patch('/fcm-token', auth, async (req, res) => {
  try {
    const {fcmToken} = req.body;

    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({
        error: 'fcmToken is required',
      });
    }

    await Student.findByIdAndUpdate(req.user.id, {
      fcmToken,
    });

    res.json({
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

/* ────────────────────────────────────────────────────────────
 * PROFILE PHOTO UPLOAD
 * ────────────────────────────────────────────────────────────
 *
 * PATCH /api/students/profile-photo
 *
 * multipart/form-data
 * field name: photo
 */

router.patch(
  '/profile-photo',
  auth,
  upload.single('photo'),

  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No photo file provided',
        });
      }

      /* ─────────────────────────────────────
       * GET OLD PHOTO INFO
       * ───────────────────────────────────── */

      const student = await Student.findById(req.user.id)
        .select('name profilePhoto profilePhotoFileId branch batch')
        .populate('branch')
        .populate('batch');

      if (!student) {
        return res.status(404).json({
          error: 'Student not found',
        });
      }

      /* ─────────────────────────────────────
       * DELETE OLD IMAGE FROM IMAGEKIT
       * ───────────────────────────────────── */

      if (student.profilePhotoFileId) {
        try {
          await imagekit.deleteFile(student.profilePhotoFileId);
        } catch (deleteErr) {
          console.error(
            'Failed to delete old ImageKit file:',
            deleteErr.message,
          );
        }
      }

      /* ─────────────────────────────────────
       * CREATE FILE NAME
       * ───────────────────────────────────── */

      const extension =
        path.extname(req.file.originalname) || '.jpg';

      const fileName =
        `profile_${Date.now()}${extension}`;

      /* ─────────────────────────────────────
       * UPLOAD TO IMAGEKIT
       * Goes into the student's own certificate folder
       * (/certificates/{branch}/{batch}/{studentName}) instead of a
       * separate flat folder, so each student only ever needs one folder.
       * ───────────────────────────────────── */

      const folderPath = buildStudentCertFolder(student.branch?.name, student.batch?.name, student.name)
        || '/student-profiles'; // fallback if branch/batch aren't set yet

      const uploadResponse = await imagekit.upload({
        file: req.file.buffer,
        fileName,

        folder: folderPath,
        useUniqueFileName: false,
      });

      /* ─────────────────────────────────────
       * SAVE TO DB
       * ───────────────────────────────────── */

      student.profilePhoto = uploadResponse.url;
      student.profilePhotoFileId = uploadResponse.fileId;

      await student.save();

      logActivity({
        req,
        actorType: 'student',
        actorId: req.user.id,
        actorName: student.name,
        action: 'student_profile_photo_updated',
        description: `${student.name} updated their profile photo`,
        targetType: 'Student',
        targetId: student._id,
        targetName: student.name,
      });

      /* ─────────────────────────────────────
       * RESPONSE
       * ───────────────────────────────────── */

      res.json({
        success: true,
        profilePhoto: uploadResponse.url,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: err.message || 'Profile photo upload failed',
      });
    }
  },
);
/* ────────────────────────────────────────────────────────────
 * GET MY TUTOR
 * Returns the tutor assigned to the student batch.
 * ──────────────────────────────────────────────────────────── */

router.get('/my-tutor', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('batch');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (!student.batch) return res.json({ tutor: null });

    const tutor = await Tutor.findOne({ batch: student.batch })
      .populate('batch',  'name')
      .populate('branch', 'name')
      .select('name email profilePhoto batch branch');

    res.json({ tutor: tutor || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────────────────────────────────
 * GET MY HOD + PRINCIPAL
 * HOD is scoped to the student's branch (role: 'hod', no batch set).
 * Principal is global (role: 'principal', no branch/batch set).
 * ──────────────────────────────────────────────────────────── */

router.get('/my-staff', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('branch');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const [hod, principal] = await Promise.all([
      student.branch
        ? Tutor.findOne({ role: 'hod', branch: student.branch })
            .populate('branch', 'name')
            .select('name email profilePhoto branch')
        : null,
      Tutor.findOne({ role: 'principal' }).select('name email profilePhoto'),
    ]);

    res.json({ hod: hod || null, principal: principal || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

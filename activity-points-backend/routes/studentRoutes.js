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

const auth = require('../middleware/auth');

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
        '-password -otp -otpExpiry -resetPasswordToken -resetPasswordExpires',
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

      const student = await Student.findById(req.user.id).select(
        'profilePhoto profilePhotoFileId',
      );

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
        `student_${req.user.id}_${Date.now()}${extension}`;

      /* ─────────────────────────────────────
       * UPLOAD TO IMAGEKIT
       * ───────────────────────────────────── */

      const uploadResponse = await imagekit.upload({
        file: req.file.buffer,
        fileName,

        folder: '/student-profiles',
        useUniqueFileName: false,
      });

      /* ─────────────────────────────────────
       * SAVE TO DB
       * ───────────────────────────────────── */

      student.profilePhoto = uploadResponse.url;
      student.profilePhotoFileId = uploadResponse.fileId;

      await student.save();

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

module.exports = router;

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const {
  uploadCertificate,
  getMyCertificates
} = require('../controllers/uploadController');

// Upload certificate
router.post('/upload', authMiddleware, uploadCertificate);

// Get logged-in student's certificates
router.get('/my', authMiddleware, getMyCertificates);

module.exports = router;

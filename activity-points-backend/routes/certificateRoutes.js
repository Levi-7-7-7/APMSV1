const express = require('express');
const router  = express.Router();

const authMiddleware       = require('../middleware/auth');
const { deleteFile }       = require('../utils/googledrive');
const Certificate          = require('../models/Certificate');
const { uploadCertificate, getMyCertificates } = require('../controllers/uploadController');

// Upload certificate
router.post('/upload', authMiddleware, uploadCertificate);

// Get logged-in student's certificates
router.get('/my', authMiddleware, getMyCertificates);

// DELETE /certificates/:id — student cancels their own pending certificate
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id);

    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    if (cert.student.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Not authorised to delete this certificate' });
    }

    if (cert.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending certificates can be cancelled' });
    }

    // Remove file from Google Drive (best-effort — don't fail the request if Drive errors)
    if (cert.fileId) {
      try {
        await deleteFile(cert.fileId);
      } catch (driveErr) {
        console.warn('Google Drive delete warning:', driveErr.message);
      }
    }

    await Certificate.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Certificate cancelled and deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

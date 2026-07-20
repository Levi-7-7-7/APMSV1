const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const imagekit = require('../utils/imagekit');
const Certificate = require('../models/Certificate');
const logActivity = require('../utils/activityLog');
const {
  uploadCertificate,
  getMyCertificates,
  reuploadCertificate
} = require('../controllers/uploadController');

// Upload certificate
router.post('/upload', authMiddleware, uploadCertificate);

// Re-upload the file on a certificate the tutor rejected (same record, new file)
router.put('/:id/reupload', authMiddleware, reuploadCertificate);

// Get logged-in student's certificates
router.get('/my', authMiddleware, getMyCertificates);

// DELETE /certificates/:id — student cancels their own pending certificate
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id);

    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

     // Safety: only the owning student can delete.
    // Both sides coerced to string — req.user.id is already a string (see auth.js),
    // cert.student is a Mongoose ObjectId; .toString() makes comparison safe.
    if (cert.student.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Not authorised to delete this certificate' });
    }

    // Only pending certificates can be cancelled by the student
    if (cert.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending certificates can be cancelled' });
    }

   // Remove file from ImageKit (best-effort — don't fail if it errors)
    if (cert.fileId) {
      try {
        await imagekit.deleteFile(cert.fileId);
      } catch (ikErr) {
        console.warn('ImageKit delete warning:', ikErr.message);
      }
    }

    await Certificate.findByIdAndDelete(req.params.id);

    logActivity({
      req,
      actorType: 'student',
      actorId: req.user.id,
      action: 'certificate_deleted',
      description: `Student cancelled/deleted certificate "${cert.eventName || cert.subcategory || ''}"`,
      targetType: 'Certificate',
      targetId: cert._id,
      targetName: cert.eventName || cert.subcategory,
    });

    res.json({ success: true, message: 'Certificate cancelled and deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

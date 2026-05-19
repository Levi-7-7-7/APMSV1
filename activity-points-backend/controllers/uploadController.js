const multer      = require('multer');
const { uploadFile } = require('../utils/googledrive');
const Certificate = require('../models/Certificate');
const Category    = require('../models/Category');
const Student     = require('../models/Student');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Sanitize names for Drive-safe folder/file names
function sanitizeName(str) {
  return (str || 'unknown')
    .trim()
    .replace(/[\/\\:*?"<>|#]/g, '_')
    .replace(/\s+/g, '_');
}

exports.uploadCertificate = [
  upload.single('file'),

  async (req, res) => {
    try {
      const studentId = req.user.id;

      const {
        categoryId,
        subcategoryName,
        level,
        prizeType,
        eventName,
        dateFrom,
        dateTo
      } = req.body;

      if (!req.file || !categoryId || !subcategoryName) {
        return res.status(400).json({
          message: "Missing required fields (file, categoryId, subcategoryName)"
        });
      }

      // Handle "Others"
      const isOthers = categoryId === 'others';
      let potentialPoints = 0;

      if (!isOthers) {
        const category = await Category.findById(categoryId);

        if (!category) {
          return res.status(404).json({ message: "Category not found" });
        }

        const sub = category.subcategories.find(
          s => s.name.toLowerCase() === subcategoryName.toLowerCase()
        );

        if (!sub) {
          return res.status(404).json({
            message: "Subcategory not found in category"
          });
        }

        // Calculate potential points
        if (sub.fixedPoints != null) {
          potentialPoints = sub.fixedPoints;
        } else if (sub.levels?.length && level && prizeType) {
          const lvl = sub.levels.find(
            l => l.name.toLowerCase() === level.toLowerCase()
          );

          const prize = lvl?.prizes.find(
            p => p.type === prizeType
          );

          potentialPoints = prize?.points ?? 0;
        }
      }

      // Fetch student with branch + batch
      const student = await Student.findById(studentId)
        .populate('branch')
        .populate('batch');

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Folder structure
      const department  = sanitizeName(student.branch?.name);
      const batch       = sanitizeName(student.batch?.name);
      const studentName = sanitizeName(student.name);

      // Use event name as certificate filename
      const ext = req.file.originalname.split('.').pop();

      const baseName = sanitizeName(
        eventName?.trim() || req.file.originalname
      );

      const certFileName = `${baseName}.${ext}`;

      // Upload to Google Drive
      // Structure:
      // root/department/batch/studentName/certificate.pdf
      const uploadResult = await uploadFile({
        fileBuffer: req.file.buffer,
        fileName: certFileName,
        mimeType: req.file.mimetype,
        department,
        batch,
        studentName,
      });

      // Save certificate
      const cert = await Certificate.create({
        student:       studentId,
        category:      isOthers ? null : categoryId,
        subcategory:   subcategoryName,
        level:         level || null,
        prizeType:     prizeType || null,
        eventName:     eventName?.trim() || '',
        dateFrom:      dateFrom || null,
        dateTo:        dateTo || null,

        fileUrl:       uploadResult.url,
        fileId:        uploadResult.fileId,

        potentialPoints,
        status:        'pending',
        pointsAwarded: 0,
        isOthers,
      });

      res.json({
        message: "Certificate uploaded successfully",
        certificate: cert
      });

    } catch (error) {
      console.error("Upload Error:", error);

      res.status(500).json({
        message: "Upload failed",
        error: error.message
      });
    }
  }
];

exports.getMyCertificates = async (req, res) => {
  try {
    const { since, notifyOnly } = req.query;

    // Notification-only fast path
    if (since && notifyOnly === 'true') {
      const sinceDate = new Date(since);

      if (isNaN(sinceDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid `since` date'
        });
      }

      const changed = await Certificate.find({
        student: req.user.id,
        status: { $in: ['approved', 'rejected'] },
        updatedAt: { $gt: sinceDate },
      })
        .select('_id eventName subcategory status rejectionReason updatedAt')
        .lean();

      return res.json({ notifications: changed });
    }

    // Full fetch
    const certs = await Certificate.find({
      student: req.user.id
    })
      .populate('category', 'name maxPoints')
      .sort({ createdAt: -1 });

    res.json({ certificates: certs });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

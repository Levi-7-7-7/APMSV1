const multer    = require('multer');
const imagekit  = require('../utils/imagekit');
const Certificate = require('../models/Certificate');
const Category    = require('../models/Category');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// FIX: was using base64 body field — now uses multipart/form-data (matches frontend)
// FIX: was saving subcategoryId (ObjectId) as cert.subcategory — schema expects subcategory NAME (string)
// FIX: was reading prizeLevel — frontend sends level + prizeType separately
exports.uploadCertificate = [
  upload.single('file'),
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const { categoryId, subcategoryName, level, prizeType } = req.body;

      if (!req.file || !categoryId || !subcategoryName) {
        return res.status(400).json({ message: "Missing required fields (file, categoryId, subcategoryName)" });
      }

      const category = await Category.findById(categoryId);
      if (!category) return res.status(404).json({ message: "Category not found" });

      // Validate subcategory exists by name
      const sub = category.subcategories.find(
        s => s.name.toLowerCase() === subcategoryName.toLowerCase()
      );
      if (!sub) return res.status(404).json({ message: "Subcategory not found in category" });

      // Calculate potentialPoints at upload time so student sees an estimate
      let potentialPoints = 0;
      if (sub.fixedPoints != null) {
        potentialPoints = sub.fixedPoints;
      } else if (sub.levels?.length && level && prizeType) {
        const lvl  = sub.levels.find(l => l.name.toLowerCase() === level.toLowerCase());
        const prize = lvl?.prizes.find(p => p.type === prizeType);
        potentialPoints = prize?.points ?? 0;
      }

      // Upload file to ImageKit
      const base64File = req.file.buffer.toString('base64');
      const uploadResult = await imagekit.upload({
        file: base64File,
        fileName: `${Date.now()}_${req.file.originalname}`,
        folder: '/certificates',
      });

      const cert = await Certificate.create({
        student:         studentId,
        category:        categoryId,
        subcategory:     subcategoryName,   // FIX: store name string, not ObjectId
        level:           level   || null,
        prizeType:       prizeType || null,
        fileUrl:         uploadResult.url,
        fileId:          uploadResult.fileId,
        potentialPoints,
        status:          'pending',
        pointsAwarded:   0,
      });

      res.json({ message: "Certificate uploaded successfully", certificate: cert });
    } catch (error) {
      console.error("Upload Error:", error);
      res.status(500).json({ message: "Upload failed", error: error.message });
    }
  }
];

exports.getMyCertificates = async (req, res) => {
  try {
    const certs = await Certificate.find({ student: req.user.id })
      .populate('category', 'name maxPoints')
      .sort({ createdAt: -1 });
    res.json({ certificates: certs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

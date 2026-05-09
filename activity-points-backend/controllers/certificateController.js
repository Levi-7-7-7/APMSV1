const imagekit = require('../utils/imagekit');
const Certificate = require('../models/Certificate');
const Category = require('../models/Category');

exports.uploadCertificate = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { fileBase64, fileName, categoryId, subcategoryId, prizeLevel } = req.body;

    if (!fileBase64 || !fileName || !categoryId || !subcategoryId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate category and subcategory exist
    const category = await Category.findById(categoryId);
    if (!category) return res.status(404).json({ message: "Category not found" });

    const sub = category.subcategories.id(subcategoryId);
    if (!sub) return res.status(404).json({ message: "Subcategory not found" });

    // Upload to ImageKit
    const uploadResult = await imagekit.upload({
      file: fileBase64,
      fileName,
      folder: "/certificates"
    });

    // Save certificate
    const cert = await Certificate.create({
      student: studentId,
      category: categoryId,
      subcategory: subcategoryId,
      prizeLevel,
      fileUrl: uploadResult.url,
      fileId: uploadResult.fileId,
      status: "pending",
      pointsAwarded: null
    });

    res.json({ message: "Certificate uploaded", certificate: cert });

  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
};

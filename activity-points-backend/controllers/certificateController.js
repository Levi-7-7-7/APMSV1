//actually not using this file, I mean its confusing so yeah...
const imagekit = require('../utils/imagekit');
const Certificate = require('../models/Certificate');
const Category = require('../models/Category');
const Student = require('../models/Student');

// Helper: sanitize a string so it's safe to use as a folder/file name
function sanitizeName(str) {
  return (str || 'unknown')
    .trim()
    .replace(/[\/\\:*?"<>|]/g, '_')  // remove characters not allowed in paths
    .replace(/\s+/g, '_');            // replace spaces with underscores
}

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

    // Fetch student with their branch (department) populated
    const student = await Student.findById(studentId).populate('branch');
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Build the folder path: /certificates/{department}/{studentName}
    const department = sanitizeName(student.branch?.name);
    const studentName = sanitizeName(student.name);
    const folderPath = `/certificates/${department}/${studentName}`;

    // Use the original fileName (without extension) as the certificate file name
    const certFileName = sanitizeName(fileName);

    // Upload to ImageKit under the structured folder
    const uploadResult = await imagekit.upload({
      file: fileBase64,
      fileName: certFileName,
      folder: folderPath
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

// routes/adminRoutes.js
const express  = require("express");
const multer   = require("multer");
const fs       = require("fs");
const csv      = require("csv-parser");

const Tutor    = require("../models/Tutor");
const Batch    = require("../models/Batch");
const Branch   = require("../models/Branch");
const Category = require("../models/Category");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ─── TUTORS ──────────────────────────────────────────────────────────────────

router.post("/tutors", adminAuth, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const tutor = await Tutor.create({ name, email, password });
    res.json({ success: true, tutor });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// FIX: populate batch & branch so UI can show assigned values
router.get("/tutors", adminAuth, async (req, res) => {
  try {
    const tutors = await Tutor.find()
      .select("name email createdAt batch branch")
      .populate("batch",   "name")
      .populate("branch",  "name");
    res.json({ success: true, tutors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/tutors/:id", adminAuth, async (req, res) => {
  try {
    await Tutor.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// FIX: new endpoint — assign batch and/or branch to a tutor
router.patch("/tutors/:id/assign", adminAuth, async (req, res) => {
  try {
    const { batchId, branchId } = req.body;
    const update = {};
    if (batchId)  update.batch  = batchId;
    if (branchId) update.branch = branchId;
    if (!Object.keys(update).length)
      return res.status(400).json({ error: "Provide batchId or branchId" });

    const tutor = await Tutor.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate("batch", "name").populate("branch", "name");
    if (!tutor) return res.status(404).json({ error: "Tutor not found" });
    res.json({ success: true, tutor });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post("/tutors/upload", adminAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      try {
        const docs = results.map(r => ({ name: r.name, email: r.email, password: r.password }));
        await Tutor.insertMany(docs, { ordered: false });
        fs.unlinkSync(req.file.path);
        res.json({ success: true, message: `${docs.length} tutors uploaded` });
      } catch (err) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(400).json({ error: err.message });
      }
    });
});

// ─── BATCHES ─────────────────────────────────────────────────────────────────

router.post("/batches", adminAuth, async (req, res) => {
  try {
    const b = await Batch.create({ name: req.body.name });
    res.json({ success: true, batch: b });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get("/batches", adminAuth, async (req, res) => {
  try {
    const batches = await Batch.find();
    res.json({ success: true, batches });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// FIX: delete was defined here but not wired in UI — now UI calls it correctly
router.delete("/batches/:id", adminAuth, async (req, res) => {
  try {
    await Batch.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BRANCHES ────────────────────────────────────────────────────────────────

router.post("/branches", adminAuth, async (req, res) => {
  try {
    const br = await Branch.create({ name: req.body.name });
    res.json({ success: true, branch: br });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get("/branches", adminAuth, async (req, res) => {
  try {
    const branches = await Branch.find();
    res.json({ success: true, branches });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// FIX: delete was defined here but not wired in UI — now UI calls it correctly
router.delete("/branches/:id", adminAuth, async (req, res) => {
  try {
    await Branch.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

router.get("/categories", adminAuth, async (req, res) => {
  try {
    const categories = await Category.find();
    res.json({ success: true, categories });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/categories", adminAuth, async (req, res) => {
  try {
    const { name, description, maxPoints, minDuration } = req.body;
    const cat = await Category.create({ name, description, maxPoints, minDuration, subcategories: [] });
    res.json({ success: true, category: cat });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put("/categories/:id", adminAuth, async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, category: cat });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete("/categories/:id", adminAuth, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/categories/:id/subcategory", adminAuth, async (req, res) => {
  try {
    const { name, points } = req.body;
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    cat.subcategories.push({ name, fixedPoints: Number(points), maxPoints: null, levels: [] });
    await cat.save();
    res.json({ success: true, category: cat });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete("/categories/:categoryId/subcategory/:subId", adminAuth, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.categoryId);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const sub = cat.subcategories.id(req.params.subId);
    if (sub) sub.deleteOne();
    await cat.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

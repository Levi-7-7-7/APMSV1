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
    const { name, email, password, role } = req.body;
    const tutor = await Tutor.create({ name, email, password, role: role || 'tutor' });
    res.json({ success: true, tutor });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// FIX: populate batch & branch so UI can show assigned values
router.get("/tutors", adminAuth, async (req, res) => {
  try {
    const tutors = await Tutor.find()
      .select("name email createdAt batch branch role")
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
    const { batchId, branchId, role } = req.body;
    const update = {};
    if (batchId)  update.batch  = batchId;
    if (branchId) update.branch = branchId;
    if (role)     update.role   = role;

    if (!Object.keys(update).length)
      return res.status(400).json({ error: "Provide batchId, branchId, or role" });

    // HOD: sees every batch in their branch — no batch should be set.
    // Principal: sees every batch and branch — neither should be set.
    // (The /tutor/students query already only filters by whichever of
    // batch/branch is set, so clearing these is all that's needed.)
    if (role === 'hod')       update.batch = null;
    if (role === 'principal') { update.batch = null; update.branch = null; }

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

// Edit a subcategory (name + fixedPoints)
router.put("/categories/:categoryId/subcategory/:subId", adminAuth, async (req, res) => {
  try {
    const { name, points } = req.body;
    const cat = await Category.findById(req.params.categoryId);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const sub = cat.subcategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ error: "Subcategory not found" });
    if (name) sub.name = name;
    sub.fixedPoints = points != null ? Number(points) : null;
    await cat.save();
    res.json({ success: true, category: cat });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Add a level to a subcategory
router.post("/categories/:categoryId/subcategory/:subId/level", adminAuth, async (req, res) => {
  try {
    const { name, prizes } = req.body;
    const cat = await Category.findById(req.params.categoryId);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const sub = cat.subcategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ error: "Subcategory not found" });
    if (sub.levels.find(l => l.name === name)) return res.status(400).json({ error: "Level already exists" });
    sub.levels.push({ name, prizes: prizes || [] });
    // If this subcategory has levels, clear fixedPoints so it's level-based
    sub.fixedPoints = null;
    await cat.save();
    res.json({ success: true, category: cat });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Edit an existing level's name and/or prizes
router.put("/categories/:categoryId/subcategory/:subId/level/:levelName", adminAuth, async (req, res) => {
  try {
    const { name, prizes } = req.body;
    const cat = await Category.findById(req.params.categoryId);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const sub = cat.subcategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ error: "Subcategory not found" });
    const levelName = decodeURIComponent(req.params.levelName);
    const level = sub.levels.find(l => l.name === levelName);
    if (!level) return res.status(404).json({ error: "Level not found" });

    // If renaming, make sure the new name doesn't clash with a different level
    if (name && name !== levelName && sub.levels.some(l => l.name === name)) {
      return res.status(400).json({ error: "A level with that name already exists" });
    }

    if (name) level.name = name;
    if (prizes) level.prizes = prizes;
    await cat.save();
    res.json({ success: true, category: cat });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Delete a level from a subcategory
router.delete("/categories/:categoryId/subcategory/:subId/level/:levelName", adminAuth, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.categoryId);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const sub = cat.subcategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ error: "Subcategory not found" });
    const levelName = decodeURIComponent(req.params.levelName);
    sub.levels = sub.levels.filter(l => l.name !== levelName);
    await cat.save();
    res.json({ success: true, category: cat });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

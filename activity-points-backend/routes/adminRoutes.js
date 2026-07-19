// routes/adminRoutes.js
const express  = require("express");
const multer   = require("multer");
const fs       = require("fs");
const csv      = require("csv-parser");
const bcrypt   = require("bcryptjs");

const Tutor    = require("../models/Tutor");
const Batch    = require("../models/Batch");
const Branch   = require("../models/Branch");
const Category = require("../models/Category");
const adminAuth = require("../middleware/adminAuth");
const deleteBatchCascade = require("../utils/deleteBatchCascade");
const { validateTutorRoleConfig } = require("../utils/tutorRoleRules");
const logActivity = require("../utils/activityLog");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ─── TUTORS ──────────────────────────────────────────────────────────────────

router.post("/tutors", adminAuth, async (req, res) => {
  try {
    // Role/batch/branch are REQUIRED at creation time — there is no more
    // "create bare, assign later" path. The combination is validated against
    // the same rules used by PATCH /tutors/:id/assign (see
    // utils/tutorRoleRules.js), so an account can never be created in an
    // inconsistent state:
    //   tutor     -> batch AND branch required
    //   hod       -> branch required, batch must be left blank
    //   principal -> both left blank
    const { name, email, password, role, batchId, branchId } = req.body;

    if (!role) return res.status(400).json({ error: 'role is required (tutor, hod, or principal)' });

    let finalBatch  = batchId  || null;
    let finalBranch = branchId || null;

    // Force the correct blanks for hod/principal even if stray ids were sent.
    if (role === 'hod')       finalBatch = null;
    if (role === 'principal') { finalBatch = null; finalBranch = null; }

    const configError = validateTutorRoleConfig(role, finalBatch, finalBranch);
    if (configError) return res.status(400).json({ error: configError });

    const tutor = await Tutor.create({
      name, email, password, role,
      batch: finalBatch, branch: finalBranch,
    });
    const populated = await tutor.populate([{ path: 'batch', select: 'name' }, { path: 'branch', select: 'name' }]);

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'tutor_created',
      description: `Admin created ${role} account ${name} (${email})`,
      targetType: 'Tutor',
      targetId: tutor._id,
      targetName: name,
      meta: { role },
    });

    res.json({ success: true, tutor: populated });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// FIX: populate batch & branch so UI can show assigned values
router.get("/tutors", adminAuth, async (req, res) => {
  try {
    const tutors = await Tutor.find()
      .select("name email createdAt batch branch role profilePhoto")
      .populate("batch",   "name")
      .populate("branch",  "name");
    res.json({ success: true, tutors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/tutors/:id", adminAuth, async (req, res) => {
  try {
    const deleted = await Tutor.findByIdAndDelete(req.params.id);

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'tutor_deleted',
      description: `Admin deleted tutor account${deleted ? ` ${deleted.name} (${deleted.email})` : ''}`,
      targetType: 'Tutor',
      targetId: req.params.id,
      targetName: deleted?.name || null,
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Assign role and/or batch and/or branch to a tutor-side account.
// Validates the RESULTING combination (existing values merged with this
// update) against the rules in utils/tutorRoleRules.js before saving, so a
// tutor can never end up half-configured (e.g. role 'tutor' with a batch
// but no branch, or a leftover branch on an account just switched to
// 'principal').
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

    const existing = await Tutor.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Tutor not found" });

    // Merge this update onto the existing account to see the FINAL shape,
    // and validate that before writing anything.
    const effectiveRole   = update.role   !== undefined ? update.role   : existing.role;
    const effectiveBatch  = 'batch'  in update ? update.batch  : existing.batch;
    const effectiveBranch = 'branch' in update ? update.branch : existing.branch;

    const configError = validateTutorRoleConfig(effectiveRole, effectiveBatch, effectiveBranch);
    if (configError) return res.status(400).json({ error: configError });

    const tutor = await Tutor.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate("batch", "name").populate("branch", "name");

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'tutor_assigned',
      description: `Admin updated tutor ${tutor?.name || req.params.id}${role ? ` — role set to ${role}` : ''}${tutor?.batch ? `, batch: ${tutor.batch.name}` : ''}${tutor?.branch ? `, branch: ${tutor.branch.name}` : ''}`,
      targetType: 'Tutor',
      targetId: req.params.id,
      targetName: tutor?.name,
      meta: update,
    });

    res.json({ success: true, tutor });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// CSV columns required: name, email, password, role (tutor/hod/principal),
// batch (batch NAME, only for role=tutor), branch (branch NAME, for
// role=tutor/hod). Same validation as single-tutor creation — a row that
// doesn't satisfy its role's batch/branch shape is skipped and reported,
// never silently created half-configured.
router.post("/tutors/upload", adminAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("error", (err) => {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      if (!res.headersSent) res.status(400).json({ error: `Failed to read CSV: ${err.message}` });
    })
    .on("end", async () => {
      try {
        const allBatches  = await Batch.find();
        const allBranches = await Branch.find();
        const batchByName  = new Map(allBatches.map(b => [b.name.trim().toLowerCase(), b._id]));
        const branchByName = new Map(allBranches.map(b => [b.name.trim().toLowerCase(), b._id]));

        const docs = [];
        const skipped = [];

        for (const [i, r] of results.entries()) {
          const rowLabel = `Row ${i + 2} (${r.email || r.name || 'unknown'})`; // +2: header row + 1-indexing
          const role = (r.role || '').trim().toLowerCase();

          if (!r.name || !r.email || !r.password) {
            skipped.push(`${rowLabel}: missing name, email, or password`);
            continue;
          }

          let batchId = null, branchId = null;

          if (role === 'tutor' || role === 'hod') {
            if (r.branch) {
              branchId = branchByName.get(r.branch.trim().toLowerCase()) || null;
              if (!branchId) { skipped.push(`${rowLabel}: branch "${r.branch}" not found`); continue; }
            }
          }
          if (role === 'tutor') {
            if (r.batch) {
              batchId = batchByName.get(r.batch.trim().toLowerCase()) || null;
              if (!batchId) { skipped.push(`${rowLabel}: batch "${r.batch}" not found`); continue; }
            }
          }

          const configError = validateTutorRoleConfig(role, batchId, branchId);
          if (configError) { skipped.push(`${rowLabel}: ${configError}`); continue; }

          const hashedPassword = await bcrypt.hash(r.password, 10);
          docs.push({
            name: r.name.trim(),
            email: r.email.trim(),
            password: hashedPassword, // pre-hashed — insertMany skips the pre-save hashing hook
            role,
            batch: batchId,
            branch: branchId,
          });
        }

        let insertedCount = 0;
        if (docs.length) {
          const inserted = await Tutor.insertMany(docs, { ordered: false });
          insertedCount = inserted.length;
        }

        fs.unlinkSync(req.file.path);

        logActivity({
          req,
          actorType: 'admin',
          actorId: req.admin?.id,
          actorEmail: req.admin?.email,
          action: 'tutors_bulk_uploaded',
          description: `Admin uploaded ${insertedCount} tutor(s) via CSV${skipped.length ? ` (${skipped.length} skipped)` : ''}`,
          meta: { count: insertedCount, skipped: skipped.length },
        });

        res.json({
          success: true,
          message: `${insertedCount} tutor(s) uploaded${skipped.length ? `, ${skipped.length} skipped` : ''}`,
          skipped,
        });
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

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'batch_created',
      description: `Admin created batch "${b.name}"`,
      targetType: 'Batch',
      targetId: b._id,
      targetName: b.name,
    });

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
    const deleted = await Batch.findByIdAndDelete(req.params.id);

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'batch_deleted',
      description: `Admin deleted batch${deleted ? ` "${deleted.name}"` : ''}`,
      targetType: 'Batch',
      targetId: req.params.id,
      targetName: deleted?.name,
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BATCH DELETE STUDENTS ───────────────────────────────────────────────────
// DELETE /admin/batches/:id/students?branch=<branchId>
//
// For clearing out students who have already passed out: removes every
// student in this batch (optionally scoped to one branch, e.g. "2022-2026
// Computer Science"), their Certificate documents, their profile photos on
// ImageKit, and — unlike deleting students one at a time — the whole batch's
// certificate folder(s) on ImageKit in one shot
// (/certificates/{branch}/{batch}), so nothing lingers on the file server.
router.delete("/batches/:id/students", adminAuth, async (req, res) => {
  try {
    const { branch } = req.query;
    const result = await deleteBatchCascade(req.params.id, branch || null);
    if (!result) return res.status(404).json({ error: "Batch not found" });

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'batch_students_deleted',
      description: `Admin deleted ${result.deletedCount} student(s) from ${result.batch.name}${result.branch ? ` (${result.branch.name})` : ""}`,
      targetType: 'Batch',
      targetId: req.params.id,
      targetName: result.batch.name,
      meta: { deletedCount: result.deletedCount, branch: result.branch?.name || null },
    });

    res.json({
      success: true,
      message: result.deletedCount
        ? `${result.deletedCount} student(s) deleted from ${result.batch.name}${result.branch ? ` (${result.branch.name})` : ""}`
        : `No students found in ${result.batch.name}${result.branch ? ` (${result.branch.name})` : ""}`,
      deletedCount: result.deletedCount,
      deletedNames: result.deletedNames,
      branchesCleaned: result.branchesCleaned,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── BRANCHES ────────────────────────────────────────────────────────────────

router.post("/branches", adminAuth, async (req, res) => {
  try {
    const br = await Branch.create({ name: req.body.name });

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'branch_created',
      description: `Admin created branch "${br.name}"`,
      targetType: 'Branch',
      targetId: br._id,
      targetName: br.name,
    });

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
    const deleted = await Branch.findByIdAndDelete(req.params.id);

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'branch_deleted',
      description: `Admin deleted branch${deleted ? ` "${deleted.name}"` : ''}`,
      targetType: 'Branch',
      targetId: req.params.id,
      targetName: deleted?.name,
    });

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

    logActivity({
      req, actorType: 'admin', actorId: req.admin?.id, actorEmail: req.admin?.email,
      action: 'category_created',
      description: `Admin created category "${cat.name}"`,
      targetType: 'Category', targetId: cat._id, targetName: cat.name,
    });

    res.json({ success: true, category: cat });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put("/categories/:id", adminAuth, async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });

    logActivity({
      req, actorType: 'admin', actorId: req.admin?.id, actorEmail: req.admin?.email,
      action: 'category_updated',
      description: `Admin updated category "${cat?.name}"`,
      targetType: 'Category', targetId: req.params.id, targetName: cat?.name,
    });

    res.json({ success: true, category: cat });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete("/categories/:id", adminAuth, async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);

    logActivity({
      req, actorType: 'admin', actorId: req.admin?.id, actorEmail: req.admin?.email,
      action: 'category_deleted',
      description: `Admin deleted category${deleted ? ` "${deleted.name}"` : ''}`,
      targetType: 'Category', targetId: req.params.id, targetName: deleted?.name,
    });

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

    logActivity({
      req, actorType: 'admin', actorId: req.admin?.id, actorEmail: req.admin?.email,
      action: 'subcategory_created',
      description: `Admin added subcategory "${name}" to category "${cat.name}"`,
      targetType: 'Category', targetId: cat._id, targetName: cat.name,
      meta: { subcategory: name, points },
    });

    res.json({ success: true, category: cat });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete("/categories/:categoryId/subcategory/:subId", adminAuth, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.categoryId);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const sub = cat.subcategories.id(req.params.subId);
    const subName = sub?.name;
    if (sub) sub.deleteOne();
    await cat.save();

    logActivity({
      req, actorType: 'admin', actorId: req.admin?.id, actorEmail: req.admin?.email,
      action: 'subcategory_deleted',
      description: `Admin deleted subcategory "${subName}" from category "${cat.name}"`,
      targetType: 'Category', targetId: cat._id, targetName: cat.name,
      meta: { subcategory: subName },
    });

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
    const oldName = sub.name;
    if (name) sub.name = name;
    sub.fixedPoints = points != null ? Number(points) : null;
    await cat.save();

    logActivity({
      req, actorType: 'admin', actorId: req.admin?.id, actorEmail: req.admin?.email,
      action: 'subcategory_updated',
      description: `Admin updated subcategory "${oldName}" in category "${cat.name}"`,
      targetType: 'Category', targetId: cat._id, targetName: cat.name,
      meta: { subcategory: sub.name, points },
    });

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

    logActivity({
      req, actorType: 'admin', actorId: req.admin?.id, actorEmail: req.admin?.email,
      action: 'level_created',
      description: `Admin added level "${name}" to subcategory "${sub.name}" (${cat.name})`,
      targetType: 'Category', targetId: cat._id, targetName: cat.name,
      meta: { subcategory: sub.name, level: name },
    });

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

    logActivity({
      req, actorType: 'admin', actorId: req.admin?.id, actorEmail: req.admin?.email,
      action: 'level_updated',
      description: `Admin updated level "${levelName}" in subcategory "${sub.name}" (${cat.name})`,
      targetType: 'Category', targetId: cat._id, targetName: cat.name,
      meta: { subcategory: sub.name, level: level.name },
    });

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

    logActivity({
      req, actorType: 'admin', actorId: req.admin?.id, actorEmail: req.admin?.email,
      action: 'level_deleted',
      description: `Admin deleted level "${levelName}" from subcategory "${sub.name}" (${cat.name})`,
      targetType: 'Category', targetId: cat._id, targetName: cat.name,
      meta: { subcategory: sub.name, level: levelName },
    });

    res.json({ success: true, category: cat });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

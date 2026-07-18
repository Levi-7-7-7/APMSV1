// routes/adminStudentRoutes.js
//
// Gives admins full visibility and control over students across every
// batch and branch — unlike tutors, who are scoped to their own
// batch/branch. Covers: list all (with filters), add one, move a student
// between batches/branches, and delete (with the same ImageKit cascade
// cleanup used by the tutor delete route).

const express = require('express');
const bcrypt  = require('bcryptjs');

const Student  = require('../models/Student');
const Batch    = require('../models/Batch');
const Branch   = require('../models/Branch');
const adminAuth = require('../middleware/adminAuth');

const generateDefaultPassword = require('../utils/defaultPassword');
const deleteStudentCascade    = require('../utils/deleteStudentCascade');

const router = express.Router();

// ─── LIST ALL STUDENTS (any batch/branch) ─────────────────────────────────
// Optional query params: ?batch=<id>  ?branch=<id>  ?search=<name/regno/email>
router.get('/students', adminAuth, async (req, res) => {
  try {
    const { batch, branch, search } = req.query;
    const filter = {};
    if (batch)  filter.batch  = batch;
    if (branch) filter.branch = branch;
    if (search) {
      const re = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: re }, { registerNumber: re }, { email: re }];
    }

    const students = await Student.find(filter)
      .select('name registerNumber email batch branch isLateralEntry totalPoints createdAt')
      .populate('batch', 'name')
      .populate('branch', 'name')
      .sort({ name: 1 });

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADD SINGLE STUDENT (any batch/branch) ────────────────────────────────
router.post('/students', adminAuth, async (req, res) => {
  try {
    const { name, registerNumber, email, isLateralEntry, batchId, branchId } = req.body;
    if (!name || !registerNumber || !email || !batchId || !branchId) {
      return res.status(400).json({ error: 'name, registerNumber, email, batchId and branchId are required' });
    }

    const [batch, branch] = await Promise.all([
      Batch.findById(batchId),
      Branch.findById(branchId),
    ]);
    if (!batch)  return res.status(404).json({ error: 'Batch not found' });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });

    const defaultPassword = generateDefaultPassword(name);
    const hashedPassword  = await bcrypt.hash(defaultPassword, 10);

    const student = await Student.create({
      name:           name.trim(),
      registerNumber: registerNumber.trim(),
      email:          email.trim(),
      isLateralEntry: !!isLateralEntry,
      batch:          batchId,
      branch:         branchId,
      password:       hashedPassword,
    });

    res.json({
      message: 'Student added successfully',
      defaultPassword,
      student: {
        id: student._id,
        name: student.name,
        registerNumber: student.registerNumber,
        email: student.email,
        isLateralEntry: student.isLateralEntry,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A student with that register number or email already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ─── UPDATE STUDENT (move batch/branch, edit details, toggle lateral entry) ──
router.patch('/students/:id', adminAuth, async (req, res) => {
  try {
    const { name, email, registerNumber, isLateralEntry, batchId, branchId } = req.body;

    if (batchId) {
      const batch = await Batch.findById(batchId);
      if (!batch) return res.status(404).json({ error: 'Batch not found' });
    }
    if (branchId) {
      const branch = await Branch.findById(branchId);
      if (!branch) return res.status(404).json({ error: 'Branch not found' });
    }

    const update = {};
    if (name)                              update.name = name.trim();
    if (email)                             update.email = email.trim();
    if (registerNumber)                    update.registerNumber = registerNumber.trim();
    if (typeof isLateralEntry === 'boolean') update.isLateralEntry = isLateralEntry;
    if (batchId)                           update.batch = batchId;
    if (branchId)                          update.branch = branchId;

    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('batch', 'name')
      .populate('branch', 'name');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    res.json({ success: true, student });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A student with that register number or email already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ─── BULK DELETE STUDENTS (any batch/branch) ──────────────────────────────
// Body: { ids: ["...", "...", ...] }
// Runs the same ImageKit + database cascade cleanup as the single-delete
// route below, once per student. Deletes are processed independently so
// one failure (e.g. a stale ImageKit fileId) doesn't block the rest —
// the response reports exactly which ones succeeded and which failed.
router.delete('/students', adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Provide an array of student ids to delete' });
    }

    const results = await Promise.all(ids.map(async (id) => {
      try {
        const deleted = await deleteStudentCascade(id);
        return { id, success: !!deleted, error: deleted ? null : 'Student not found' };
      } catch (err) {
        return { id, success: false, error: err.message };
      }
    }));

    const deletedIds = results.filter(r => r.success).map(r => r.id);
    const failed      = results.filter(r => !r.success);

    res.json({
      success: true,
      message: `${deletedIds.length} of ${ids.length} student(s) deleted`,
      deletedIds,
      failed, // [{ id, error }] — surfaced to the admin so nothing silently fails
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE STUDENT (any batch/branch, no restriction) ────────────────────
// Cascade delete: removes certificate files and profile photo from
// ImageKit too, not just the database records.
router.delete('/students/:id', adminAuth, async (req, res) => {
  try {
    const deleted = await deleteStudentCascade(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Student not found' });
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

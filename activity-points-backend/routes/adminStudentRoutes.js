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
const syncStudentCertFolder   = require('../utils/syncStudentCertFolder');
const logActivity = require('../utils/activityLog');

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

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'student_created',
      description: `Admin added student ${student.name} (${student.registerNumber})`,
      targetType: 'Student',
      targetId: student._id,
      targetName: student.name,
      meta: { batch: batch.name, branch: branch.name },
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

    // Snapshot name/batch/branch *before* the update — needed to work out
    // whether the student's ImageKit certificate folder needs to move.
    const folderSyncNeeded = !!(update.name || update.batch || update.branch);
    let before = null;
    if (folderSyncNeeded) {
      const prevStudent = await Student.findById(req.params.id).populate('batch', 'name').populate('branch', 'name');
      if (prevStudent) {
        before = {
          name: prevStudent.name,
          branchName: prevStudent.branch?.name,
          batchName: prevStudent.batch?.name,
        };
      }
    }

    const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('batch', 'name')
      .populate('branch', 'name');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Best-effort: move the student's certificate folder (and profile photo
    // inside it) to match their new name/batch/branch, and refresh stored
    // file URLs so nothing breaks. Never blocks the response on failure.
    let folderSync = null;
    if (before) {
      folderSync = await syncStudentCertFolder(student._id, before, {
        name: student.name,
        branchName: student.branch?.name,
        batchName: student.batch?.name,
      });
    }

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'student_updated',
      description: `Admin updated student ${student.name} (${student.registerNumber})`,
      targetType: 'Student',
      targetId: student._id,
      targetName: student.name,
      meta: update,
    });

    res.json({ success: true, student, folderSync });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A student with that register number or email already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ─── DELETE STUDENT (any batch/branch, no restriction) ────────────────────
// Cascade delete: removes certificate files and profile photo from
// ImageKit too, not just the database records.
router.delete('/students/:id', adminAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('name registerNumber');
    const deleted = await deleteStudentCascade(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Student not found' });

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin?.id,
      actorEmail: req.admin?.email,
      action: 'student_deleted',
      description: `Admin deleted student${student ? ` ${student.name} (${student.registerNumber})` : ''}`,
      targetType: 'Student',
      targetId: req.params.id,
      targetName: student?.name,
    });

    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

/**
 * routes/ticketRoutes.js
 *
 * Support tickets — three flows sharing one model (see models/Ticket.js):
 *   Student  -> creates a ticket (+ optional photo)            -> tutor
 *   Tutor    -> resolves it, OR forwards it to admin           -> admin
 *   Tutor    -> also raises their own request straight to admin
 *   Admin    -> resolves anything sitting in their queue
 *
 * Mounted at /api/tickets in index.js. Each sub-section below gates on a
 * different auth middleware (student / tutor / admin), matching the
 * pattern used by studentRoutes.js / tutorRoutes.js / adminRoutes.js.
 */
const express = require('express');
const multer = require('multer');

const Ticket = require('../models/Ticket');
const Student = require('../models/Student');
const Tutor = require('../models/Tutor');

const auth = require('../middleware/auth');
const tutorAuth = require('../middleware/tutorAuth');
const adminAuth = require('../middleware/adminAuth');

const imagekit = require('../utils/imagekit');
const { buildTicketFolder, sanitizeName } = require('../utils/imagekitPaths');
const { sendPushToUser } = require('../utils/fcm');
const logActivity = require('../utils/activityLog');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Shared helpers ────────────────────────────────────────────────────────

function ticketQuery() {
  return Ticket.find().populate('batch', 'name').populate('branch', 'name');
}

async function pushTimelineAndSave(ticket, entry) {
  ticket.timeline.push(entry);
  await ticket.save();
}

// ─────────────────────────────────────────────────────────────────────────
// STUDENT
// ─────────────────────────────────────────────────────────────────────────

// Create a ticket, optionally with a photo of the issue.
router.post('/student', auth, upload.single('image'), async (req, res) => {
  try {
    const { subject, description } = req.body;
    if (!subject?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'subject and description are required' });
    }

    const student = await Student.findById(req.user.id).populate('batch').populate('branch');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    let imageUrl = null;
    let imageFileId = null;
    if (req.file) {
      const uploadResult = await imagekit.upload({
        file: req.file.buffer.toString('base64'),
        fileName: `${sanitizeName(subject.trim())}_${Date.now()}.${req.file.originalname.split('.').pop()}`,
        folder: buildTicketFolder(student.name),
      });
      imageUrl = uploadResult.url;
      imageFileId = uploadResult.fileId;
    }

    const ticket = await Ticket.create({
      raisedByRole: 'student',
      raisedByModel: 'Student',
      raisedBy: student._id,
      raisedByName: student.name,
      raisedByEmail: student.email,
      batch: student.batch?._id || student.batch || null,
      branch: student.branch?._id || student.branch || null,
      subject: subject.trim(),
      description: description.trim(),
      imageUrl,
      imageFileId,
      status: 'open',
      currentOwner: 'tutor',
      tutorSeen: false,
      timeline: [{ action: 'created', byRole: 'student', byName: student.name, note: '' }],
    });

    // Notify the tutor assigned to this student's batch/branch.
    try {
      const tutor = await Tutor.findOne({
        batch: student.batch?._id || student.batch,
        branch: student.branch?._id || student.branch,
        role: 'tutor',
      }).select('_id');

      if (tutor) {
        await sendPushToUser(
          Tutor,
          tutor._id,
          '🎫 New Ticket Raised',
          `${student.name} raised a ticket: "${ticket.subject}"`,
          { type: 'new_ticket', ticketId: String(ticket._id), link: '/tutor/dashboard/tickets' }
        );
      }
    } catch (notifyErr) {
      console.warn('[FCM] Ticket-creation tutor notification failed:', notifyErr.message);
    }

    logActivity({
      req,
      actorType: 'student',
      actorId: student._id,
      actorName: student.name,
      actorEmail: student.email,
      action: 'ticket_created',
      description: `${student.name} raised a ticket: "${ticket.subject}"`,
      targetType: 'Ticket',
      targetId: ticket._id,
      targetName: ticket.subject,
    });

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// A student's own tickets, newest first.
router.get('/student/my', auth, async (req, res) => {
  try {
    const tickets = await ticketQuery()
      .where({ raisedByModel: 'Student', raisedBy: req.user.id })
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a resolved ticket as "seen" — clears the notification badge.
router.patch('/student/:id/seen', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, raisedByModel: 'Student', raisedBy: req.user.id });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    ticket.raiserSeen = true;
    await ticket.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unread count for the three-dot-menu badge.
router.get('/student/unread-count', auth, async (req, res) => {
  try {
    const count = await Ticket.countDocuments({
      raisedByModel: 'Student',
      raisedBy: req.user.id,
      status: 'resolved',
      raiserSeen: false,
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// TUTOR
// ─────────────────────────────────────────────────────────────────────────

async function fetchTutor(req, res) {
  const tutor = await Tutor.findById(req.tutor.id);
  if (!tutor) { res.status(404).json({ error: 'Tutor not found' }); return null; }
  return tutor;
}

// Inbox: student-raised tickets in the tutor's own batch+branch, still
// awaiting the tutor (currentOwner: 'tutor'). Pass ?scope=mine instead for
// the tutor's own requests raised straight to admin.
router.get('/tutor', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchTutor(req, res);
    if (!tutor) return;

    if (req.query.scope === 'mine') {
      const tickets = await ticketQuery()
        .where({ raisedByModel: 'Tutor', raisedBy: tutor._id })
        .sort({ createdAt: -1 });
      return res.json(tickets);
    }

    const filter = { raisedByModel: 'Student' };
    if (tutor.batch) filter.batch = tutor.batch;
    if (tutor.branch) filter.branch = tutor.branch;

    const tickets = await ticketQuery().where(filter).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tutor raises their own request directly to admin (not tied to a student).
router.post('/tutor', tutorAuth, async (req, res) => {
  try {
    const { subject, description } = req.body;
    if (!subject?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'subject and description are required' });
    }

    const tutor = await fetchTutor(req, res);
    if (!tutor) return;

    const ticket = await Ticket.create({
      raisedByRole: 'tutor',
      raisedByModel: 'Tutor',
      raisedBy: tutor._id,
      raisedByName: tutor.name,
      raisedByEmail: tutor.email,
      batch: tutor.batch || null,
      branch: tutor.branch || null,
      subject: subject.trim(),
      description: description.trim(),
      status: 'open',
      currentOwner: 'admin',
      adminSeen: false,
      timeline: [{ action: 'created', byRole: 'tutor', byName: tutor.name, note: '' }],
    });

    logActivity({
      req,
      actorType: 'tutor',
      actorId: tutor._id,
      actorName: tutor.name,
      actorEmail: tutor.email,
      action: 'ticket_created',
      description: `${tutor.name} raised a request to admin: "${ticket.subject}"`,
      targetType: 'Ticket',
      targetId: ticket._id,
      targetName: ticket.subject,
    });

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve a student's ticket directly (no escalation needed).
router.patch('/tutor/:id/resolve', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchTutor(req, res);
    if (!tutor) return;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.currentOwner !== 'tutor' || ticket.raisedByModel !== 'Student') {
      return res.status(403).json({ error: 'This ticket is not in your queue.' });
    }
    if (tutor.batch && ticket.batch && String(ticket.batch) !== String(tutor.batch)) {
      return res.status(403).json({ error: 'Ticket not in your assigned batch' });
    }
    if (tutor.branch && ticket.branch && String(ticket.branch) !== String(tutor.branch)) {
      return res.status(403).json({ error: 'Ticket not in your assigned branch' });
    }
    if (ticket.status === 'resolved') {
      return res.status(400).json({ error: 'Ticket is already resolved' });
    }

    const note = req.body.note || '';
    ticket.status = 'resolved';
    ticket.resolution = { byRole: 'tutor', byId: tutor._id, byName: tutor.name, note, at: new Date() };
    ticket.raiserSeen = false;
    ticket.tutorSeen = true;
    await pushTimelineAndSave(ticket, { action: 'resolved', byRole: 'tutor', byName: tutor.name, note });

    sendPushToUser(
      Student,
      ticket.raisedBy,
      '✅ Ticket Resolved',
      `Your ticket "${ticket.subject}" has been marked as completed.`,
      { type: 'ticket_resolved', ticketId: String(ticket._id), link: '/student/tickets' }
    ); // not awaited

    logActivity({
      req,
      actorType: 'tutor',
      actorId: tutor._id,
      actorName: tutor.name,
      actorEmail: tutor.email,
      action: 'ticket_resolved',
      description: `${tutor.name} resolved ticket "${ticket.subject}" raised by ${ticket.raisedByName}`,
      targetType: 'Ticket',
      targetId: ticket._id,
      targetName: ticket.subject,
    });

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Can't resolve it — forward the student's ticket to admin.
router.patch('/tutor/:id/forward', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchTutor(req, res);
    if (!tutor) return;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.currentOwner !== 'tutor' || ticket.raisedByModel !== 'Student') {
      return res.status(403).json({ error: 'This ticket is not in your queue.' });
    }
    if (tutor.batch && ticket.batch && String(ticket.batch) !== String(tutor.batch)) {
      return res.status(403).json({ error: 'Ticket not in your assigned batch' });
    }
    if (tutor.branch && ticket.branch && String(ticket.branch) !== String(tutor.branch)) {
      return res.status(403).json({ error: 'Ticket not in your assigned branch' });
    }
    if (ticket.status === 'resolved') {
      return res.status(400).json({ error: 'Ticket is already resolved' });
    }

    const note = req.body.note || '';
    ticket.currentOwner = 'admin';
    ticket.forwardedToAdmin = true;
    ticket.forwardedBy = { id: tutor._id, name: tutor.name };
    ticket.forwardedAt = new Date();
    ticket.forwardNote = note;
    ticket.adminSeen = false;
    ticket.tutorSeen = true;
    await pushTimelineAndSave(ticket, { action: 'forwarded', byRole: 'tutor', byName: tutor.name, note });

    logActivity({
      req,
      actorType: 'tutor',
      actorId: tutor._id,
      actorName: tutor.name,
      actorEmail: tutor.email,
      action: 'ticket_forwarded',
      description: `${tutor.name} forwarded ticket "${ticket.subject}" (raised by ${ticket.raisedByName}) to admin`,
      targetType: 'Ticket',
      targetId: ticket._id,
      targetName: ticket.subject,
    });

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a resolved ticket as "seen" — covers both a tutor's own request to
// admin, and a student ticket the tutor forwarded (once admin closes it).
router.patch('/tutor/:id/seen', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchTutor(req, res);
    if (!tutor) return;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const isOwnRequest = ticket.raisedByModel === 'Tutor' && String(ticket.raisedBy) === String(tutor._id);
    const isForwarder = ticket.forwardedBy?.id && String(ticket.forwardedBy.id) === String(tutor._id);
    if (!isOwnRequest && !isForwarder) return res.status(403).json({ error: 'Not your ticket' });

    if (isOwnRequest) ticket.raiserSeen = true;
    if (isForwarder) ticket.forwarderSeen = true;
    await ticket.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unread count for the tutor's three-dot-menu badge — own requests
// resolved-and-unseen, plus forwarded student tickets resolved-and-unseen.
router.get('/tutor/unread-count', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchTutor(req, res);
    if (!tutor) return;

    const count = await Ticket.countDocuments({
      status: 'resolved',
      $or: [
        { raisedByModel: 'Tutor', raisedBy: tutor._id, raiserSeen: false },
        { 'forwardedBy.id': tutor._id, forwarderSeen: false },
      ],
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bell-icon badge count — brand-new tickets a student has just raised into
// this tutor's inbox that the tutor hasn't opened yet. Mirrors
// /admin/unread-count, but one step earlier in the chain: keyed on arrival
// into the tutor's queue rather than resolution.
router.get('/tutor/new-count', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchTutor(req, res);
    if (!tutor) return;

    const filter = { currentOwner: 'tutor', raisedByModel: 'Student', tutorSeen: false };
    if (tutor.batch) filter.batch = tutor.batch;
    if (tutor.branch) filter.branch = tutor.branch;

    const count = await Ticket.countDocuments(filter);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lightweight feed backing the tutor's bell-icon dropdown — enough per
// ticket to render a notification row and jump straight to it.
router.get('/tutor/notifications', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchTutor(req, res);
    if (!tutor) return;

    const filter = { currentOwner: 'tutor', raisedByModel: 'Student', tutorSeen: false };
    if (tutor.batch) filter.batch = tutor.batch;
    if (tutor.branch) filter.branch = tutor.branch;

    const tickets = await Ticket.find(filter)
      .select('subject raisedByName createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a single incoming student ticket as seen — called the moment a
// tutor opens that ticket's detail (from the inbox list or a notification).
router.patch('/tutor/:id/seen-new', tutorAuth, async (req, res) => {
  try {
    const tutor = await fetchTutor(req, res);
    if (!tutor) return;

    const ticket = await Ticket.findOne({ _id: req.params.id, currentOwner: 'tutor', raisedByModel: 'Student' });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (tutor.batch && ticket.batch && String(ticket.batch) !== String(tutor.batch)) {
      return res.status(403).json({ error: 'Ticket not in your assigned batch' });
    }
    if (tutor.branch && ticket.branch && String(ticket.branch) !== String(tutor.branch)) {
      return res.status(403).json({ error: 'Ticket not in your assigned branch' });
    }

    ticket.tutorSeen = true;
    await ticket.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────

// Everything currently sitting with admin — forwarded student tickets +
// tutors' own direct requests. ?status=resolved to see the resolved queue.
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const filter = { currentOwner: 'admin' };
    if (req.query.status) filter.status = req.query.status;

    const tickets = await ticketQuery().where(filter).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bell-icon badge count — new tickets that have landed in the admin queue
// (forwarded by a tutor, or a tutor's own direct request) that no admin has
// opened yet. Mirrors /tutor/unread-count and /student/unread-count, but
// keyed on arrival rather than resolution since it's admin's turn to act.
router.get('/admin/unread-count', adminAuth, async (req, res) => {
  try {
    const count = await Ticket.countDocuments({ currentOwner: 'admin', adminSeen: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lightweight feed backing the bell-icon dropdown — just enough per ticket
// to render a notification row and jump straight to that ticket.
router.get('/admin/notifications', adminAuth, async (req, res) => {
  try {
    const tickets = await Ticket.find({ currentOwner: 'admin', adminSeen: false })
      .select('subject raisedByName raisedByRole forwardedBy status createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a single admin-queue ticket as seen — called the moment an admin
// opens that ticket's detail (either from the list or from a notification).
router.patch('/admin/:id/seen', adminAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, currentOwner: 'admin' });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    ticket.adminSeen = true;
    await ticket.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/admin/:id/resolve', adminAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.currentOwner !== 'admin') {
      return res.status(403).json({ error: 'This ticket is not in the admin queue.' });
    }
    if (ticket.status === 'resolved') {
      return res.status(400).json({ error: 'Ticket is already resolved' });
    }

    const note = req.body.note || '';
    ticket.status = 'resolved';
    // Students/tutors only ever see `resolution.byName` — never expose the
    // admin's actual email address to them, just the generic role name.
    ticket.resolution = { byRole: 'admin', byId: req.admin.id, byName: 'Admin', note, at: new Date() };
    ticket.raiserSeen = false;
    ticket.adminSeen = true;
    if (ticket.forwardedBy?.id) ticket.forwarderSeen = false;
    await pushTimelineAndSave(ticket, { action: 'resolved', byRole: 'admin', byName: 'Admin', note });

    // Notify whoever originally raised it...
    const RaiserModel = ticket.raisedByModel === 'Student' ? Student : Tutor;
    sendPushToUser(
      RaiserModel,
      ticket.raisedBy,
      '✅ Ticket Resolved',
      `Your ticket "${ticket.subject}" has been marked as completed.`,
      {
        type: 'ticket_resolved',
        ticketId: String(ticket._id),
        link: ticket.raisedByModel === 'Student' ? '/student/tickets' : '/tutor/dashboard/tickets',
      }
    ); // not awaited

    // ...and the tutor who forwarded it, if this was originally a student
    // ticket that got escalated (courtesy notification, separate from the
    // student's own).
    if (ticket.forwardedBy?.id) {
      sendPushToUser(
        Tutor,
        ticket.forwardedBy.id,
        '✅ Forwarded Ticket Resolved',
        `The ticket "${ticket.subject}" you forwarded has been marked as completed.`,
        { type: 'ticket_resolved', ticketId: String(ticket._id), link: '/tutor/dashboard/tickets' }
      ); // not awaited
    }

    logActivity({
      req,
      actorType: 'admin',
      actorId: req.admin.id,
      actorEmail: req.admin.email,
      action: 'ticket_resolved',
      description: `Admin resolved ticket "${ticket.subject}" raised by ${ticket.raisedByName}`,
      targetType: 'Ticket',
      targetId: ticket._id,
      targetName: ticket.subject,
    });

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

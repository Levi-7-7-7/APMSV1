const mongoose = require('mongoose');

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
// An append-only audit trail of every meaningful action taken by an admin,
// tutor, or student (logins, uploads, approvals, deletions, etc).
//
// IMPORTANT: this collection is intentionally immutable from the outside.
// There is no PATCH/PUT/DELETE route anywhere in the app for log entries —
// only `POST` (via logActivity(), called from inside other routes) and
// `GET` (admin-only, for viewing/exporting). Do not add update or delete
// routes for this model; the whole point of a log book is that nobody,
// including admins, can quietly edit or erase history through the app.
const activityLogSchema = new mongoose.Schema(
  {
    // Who performed the action.
    actorType: { type: String, enum: ['admin', 'tutor', 'student', 'system'], required: true },
    actorId:   { type: String, default: null },
    actorName: { type: String, default: null },
    actorEmail:{ type: String, default: null },

    // What happened — a short machine-friendly code (e.g. 'student_login',
    // 'certificate_approved') plus a human-readable one-line summary.
    action:      { type: String, required: true },
    description: { type: String, required: true },

    // What the action was performed on, if applicable (e.g. the student
    // whose certificate was approved, the tutor who was deleted, etc).
    targetType: { type: String, default: null },
    targetId:   { type: String, default: null },
    targetName: { type: String, default: null },

    // Extra structured context (e.g. { points: 20 }, { reason: '...' }).
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    ip: { type: String, default: null },
  },
  {
    // Only createdAt — there is no updatedAt because these documents are
    // never meant to change after creation.
    timestamps: { createdAt: true, updatedAt: false },
  }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ actorType: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

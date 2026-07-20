/**
 * models/Ticket.js
 *
 * Unified support-ticket model covering three flows:
 *
 *  1. Student raises a ticket (optionally with a photo of the issue).
 *     It lands with the tutor assigned to that student's batch+branch
 *     (currentOwner: 'tutor').
 *  2. That tutor either resolves it directly, or forwards it to admin
 *     if they can't handle it themselves (currentOwner flips to 'admin',
 *     forwardedToAdmin: true).
 *  3. A tutor can also raise their own request straight to admin,
 *     unrelated to any student ticket (currentOwner: 'admin' from the
 *     start, forwardedToAdmin stays false since nothing was forwarded).
 *
 * Whoever currently "owns" the ticket (currentOwner) is the one who can
 * resolve it. The original raiser (student or tutor) can always see it,
 * regardless of who's holding it — batch/branch are snapshotted at
 * creation so history stays intact even if the student is later moved
 * or removed.
 */

const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['created', 'forwarded', 'resolved', 'reopened'],
      required: true,
    },
    byRole: { type: String, enum: ['student', 'tutor', 'admin'], required: true },
    byName: { type: String, default: '' },
    note:   { type: String, default: '' },
    at:     { type: Date, default: Date.now },
  },
  { _id: false }
);

const TicketSchema = new mongoose.Schema(
  {
    // ── Who raised it ───────────────────────────────────────────────────
    raisedByRole:  { type: String, enum: ['student', 'tutor'], required: true },
    raisedByModel: { type: String, enum: ['Student', 'Tutor'], required: true },
    raisedBy:      { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'raisedByModel' },
    raisedByName:  { type: String, required: true },
    raisedByEmail: { type: String, default: null },

    // Snapshotted at creation so tutor/admin inboxes can filter without a
    // join, and so history survives batch/branch reassignment later.
    batch:  { type: mongoose.Schema.Types.ObjectId, ref: 'Batch',  default: null },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },

    subject:     { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },

    // Optional photo of the issue (ImageKit) — student complaints only.
    imageUrl:    { type: String, default: null },
    imageFileId: { type: String, default: null },

    // ── Routing / lifecycle ─────────────────────────────────────────────
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },

    // Who can currently act on it. Student-raised tickets start with the
    // tutor; tutor's own requests start with admin.
    currentOwner: { type: String, enum: ['tutor', 'admin'], required: true },

    forwardedToAdmin: { type: Boolean, default: false },
    forwardedBy:   { id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', default: null }, name: { type: String, default: null } },
    forwardedAt:   { type: Date, default: null },
    forwardNote:   { type: String, default: '' },

    resolution: {
      byRole: { type: String, enum: ['tutor', 'admin', null], default: null },
      byId:   { type: mongoose.Schema.Types.ObjectId, default: null },
      byName: { type: String, default: null },
      note:   { type: String, default: '' },
      at:     { type: Date, default: null },
    },

    timeline: { type: [timelineEntrySchema], default: [] },

    // "Unread" flags driving the three-dot-menu notification badge — flip
    // to false the moment status becomes 'resolved', flip back to true
    // once that person opens the ticket detail.
    raiserSeen:    { type: Boolean, default: true },
    forwarderSeen: { type: Boolean, default: true }, // only meaningful if forwardedBy is set

    // Admin-side notification flag — the mirror image of the two above.
    // Flips to false the moment a ticket *lands* in the admin queue (a
    // tutor's own request created straight to admin, or a student ticket
    // forwarded to admin), driving the bell-icon badge on the admin panel.
    // Flips back to true once an admin opens that ticket's detail view.
    adminSeen: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TicketSchema.index({ batch: 1, branch: 1, currentOwner: 1, status: 1 });

module.exports = mongoose.model('Ticket', TicketSchema);

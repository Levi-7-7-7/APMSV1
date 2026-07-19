const ActivityLog = require('../models/ActivityLog');

// ─── logActivity ──────────────────────────────────────────────────────────────
// Writes one entry to the append-only activity log. Never throws — a logging
// failure must never break the actual request it's describing, so any error
// here is swallowed (and printed to the server console for debugging).
//
// Usage:
//   await logActivity({
//     req,
//     actorType: 'tutor',
//     actorId:   tutor._id,
//     actorName: tutor.name,
//     actorEmail: tutor.email,
//     action:    'certificate_approved',
//     description: `Approved "${cert.eventName}" for ${student.name}`,
//     targetType: 'Certificate',
//     targetId:   cert._id,
//     targetName: cert.eventName,
//     meta:       { pointsAwarded },
//   });
async function logActivity({
  req,
  actorType,
  actorId = null,
  actorName = null,
  actorEmail = null,
  action,
  description,
  targetType = null,
  targetId = null,
  targetName = null,
  meta = {},
}) {
  try {
    const ip =
      req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      null;

    await ActivityLog.create({
      actorType,
      actorId: actorId ? String(actorId) : null,
      actorName,
      actorEmail,
      action,
      description,
      targetType,
      targetId: targetId ? String(targetId) : null,
      targetName,
      meta,
      ip,
    });
  } catch (err) {
    console.error('[ActivityLog] Failed to write log entry:', err.message);
  }
}

module.exports = logActivity;

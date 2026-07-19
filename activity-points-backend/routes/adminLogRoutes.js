// routes/adminLogRoutes.js
//
// Read-only access to the activity log for admins.
//
// IMPORTANT: this file deliberately exposes ONLY GET routes. There is no
// create/update/delete endpoint for log entries here (entries are written
// internally via utils/activityLog.js from inside other routes). Do not add
// PATCH/PUT/DELETE routes for logs — the log book must stay tamper-proof
// from every user, including admins, through the app itself.

const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Shared filter-builder so /logs and /logs/export always agree on what
// "matching the current filters" means.
function buildFilter(query) {
  const { actorType, action, search, from, to } = query;
  const filter = {};

  if (actorType) filter.actorType = actorType;
  if (action) filter.action = action;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      // Treat `to` as inclusive of the whole day if only a date was given.
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }
  }

  if (search) {
    const re = new RegExp(search.trim(), 'i');
    filter.$or = [
      { description: re },
      { actorName: re },
      { actorEmail: re },
      { targetName: re },
      { action: re },
    ];
  }

  return filter;
}

// ─── LIST LOGS (paginated, filterable) ───────────────────────────────────────
// GET /api/admin/logs?actorType=&action=&search=&from=&to=&page=&limit=
router.get('/logs', adminAuth, async (req, res) => {
  try {
    const filter = buildFilter(req.query);

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(filter),
    ]);

    // Distinct action list — lets the UI populate an "action" filter dropdown
    // without a separate round trip.
    const actions = await ActivityLog.distinct('action');

    res.json({
      success: true,
      logs,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      actions: actions.sort(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EXPORT LOGS AS CSV ───────────────────────────────────────────────────────
// GET /api/admin/logs/export?actorType=&action=&search=&from=&to=
// Respects the same filters as the list view, but returns every matching
// row (no pagination) as a downloadable .csv file.
router.get('/logs/export', adminAuth, async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).lean();

    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const header = [
      'Timestamp', 'Actor Type', 'Actor Name', 'Actor Email',
      'Action', 'Description', 'Target Type', 'Target Name', 'IP Address',
    ];

    const rows = logs.map(l => [
      new Date(l.createdAt).toISOString(),
      l.actorType,
      l.actorName,
      l.actorEmail,
      l.action,
      l.description,
      l.targetType,
      l.targetName,
      l.ip,
    ].map(escape).join(','));

    const csv = [header.map(escape).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

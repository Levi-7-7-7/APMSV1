const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Verifies the request comes from a logged-in admin
module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Not authorized as admin' });

    // Attach the admin's email too (not just id/role from the token) so
    // downstream routes can log "who did this" without a second lookup.
    const admin = await Admin.findById(decoded.id).select('email');
    req.admin = { id: decoded.id, role: decoded.role, email: admin?.email || null };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const student = await Student.findById(decoded.id).select('-password');

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    req.user = { id: student._id.toString(), role: 'student' }; // toString() ensures string comparison in DELETE route works
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

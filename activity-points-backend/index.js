require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const tutorRoutes = require('./routes/tutorRoutes');
const metaRoutes = require('./routes/metaRoutes');
const categoryRoutes = require('./routes/categories');
const certificateRoutes = require('./routes/certificateRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminStudentRoutes = require('./routes/adminStudentRoutes');
const adminLogRoutes = require('./routes/adminLogRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

const path = require('path');

const app = express();

app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Connect to MongoDB
connectDB();

// Health check
app.get('/', (req, res) => res.json({ message: 'Activity Points API is running' }));

// Student auth routes
app.use('/api/auth', authRoutes);

// Student profile & dropdown routes
app.use('/api/students', studentRoutes);

// Tutor routes (login, students, certificates)
app.use('/api/tutors', tutorRoutes);

// Batch and branch lookups (for tutor use)
app.use('/api/meta', metaRoutes);

// Category and subcategory data (public — used by student upload form)
app.use('/api/categories', categoryRoutes);

// Certificate upload and retrieval (student)
app.use('/api/certificates', certificateRoutes);

// Admin auth (login, register)
app.use('/api/admin/auth', adminAuthRoutes);

// Admin management (tutors, batches, branches, categories)
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminStudentRoutes);

// Admin-only, read-only activity log (view + CSV export)
app.use('/api/admin', adminLogRoutes);

// Support tickets — student complaints, tutor requests, admin resolution
app.use('/api/tickets', ticketRoutes);

// ── Global error handler ────────────────────────────────────────────────
// Catches multer errors (bad file type from a fileFilter, oversized file,
// etc.) and any other error passed to next(err) from route handlers, and
// always responds with JSON instead of falling through to Express's
// default HTML error page.
const multer = require('multer');
app.use((err, req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File exceeds the maximum allowed size' });
    }
    return res.status(400).json({ message: err.message });
  }

  // fileFilter callbacks reject with a plain Error — treat those as 400s too
  if (err.message && /only .*(pdf|image)/i.test(err.message)) {
    return res.status(400).json({ message: err.message });
  }

  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

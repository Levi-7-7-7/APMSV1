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
const tutorStudentRoutes = require('./routes/tutorStudentRoutes');
const metaRoutes = require('./routes/metaRoutes');
const categoryRoutes = require('./routes/categories');
const certificateRoutes = require('./routes/certificateRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');

const app = express();

app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
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

// Tutor bulk student upload (legacy mount point)
app.use('/api/tutor/students', tutorStudentRoutes);

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

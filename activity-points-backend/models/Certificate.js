const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false,  // FIX: null for "Others" certificates not in the category list
    default: null
  },
  // Name of the subcategory at upload time (stored as string so renames don't break history)
  subcategory: {
    type: String,
    required: true
  },
  // Only set for level-based activities (e.g. "National", "State")
  level: {
    type: String,
    default: null
  },
  // Only set for level-based activities
  prizeType: {
    type: String,
    enum: ['Participation', 'First', 'Second', 'Third'],
    default: null
  },
  // ImageKit file URL
  fileUrl: {
    type: String,
    required: true
  },
  // ImageKit file ID (used if we ever need to delete the file)
  fileId: {
    type: String,
    required: true
  },
  // Points calculated at upload time (shown to student before approval)
  potentialPoints: {
    type: Number,
    default: 0
  },
  // Points set by tutor when approving (0 if rejected)
  pointsAwarded: {
    type: Number,
    default: 0
  },
  // Student-entered name of the specific event / competition / course
  eventName: {
    type: String,
    default: ''
  },
  // Activity duration / certificate date range (optional)
  dateFrom: {
    type: Date,
    default: null
  },
  dateTo: {
    type: Date,
    default: null
  },
  // Reason provided by tutor when rejecting
  rejectionReason: {
    type: String,
    default: ''
  },
  // True when student chose "Others" (not in category list); admin/tutor assigns points manually
  isOthers: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('Certificate', CertificateSchema);

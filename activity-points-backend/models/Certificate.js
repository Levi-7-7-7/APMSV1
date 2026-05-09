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
    required: true
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
  // Reason provided by tutor when rejecting
  rejectionReason: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('Certificate', CertificateSchema);

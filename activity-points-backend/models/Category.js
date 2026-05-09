const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Participation', 'First', 'Second', 'Third'],
    required: true
  },
  points: { type: Number, required: true }
}, { _id: false });

const levelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  prizes: { type: [prizeSchema], default: [] }
}, { _id: false });

// _id: true (default) — needed so admin can delete subcategories by ID
const subcategorySchema = new mongoose.Schema({
  name: { type: String, required: true },

  // For simple fixed-point activities (e.g. Online Course, Industrial Visit)
  fixedPoints: { type: Number, default: null },

  // For achievement-based activities (e.g. Hackathon: College/State/National × First/Second/Third)
  levels: { type: [levelSchema], default: [] },

  // Optional cap per subcategory
  maxPoints: { type: Number, default: null }
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },

  // Category-wide cap (e.g. NCC/NSS max 50, most others max 40)
  maxPoints: { type: Number, default: 40 },

  subcategories: { type: [subcategorySchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);

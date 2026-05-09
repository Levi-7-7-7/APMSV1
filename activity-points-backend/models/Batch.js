const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., "2023-2027"
}, { timestamps: true });

module.exports = mongoose.model('Batch', batchSchema);

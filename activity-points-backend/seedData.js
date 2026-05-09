// seedData.js
const mongoose = require('mongoose');
const Batch = require('./models/Batch');
const Branch = require('./models/Branch');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await Batch.insertMany([
      { name: '2021-2025' },
      { name: '2022-2026' }
    ]);
    await Branch.insertMany([
      { name: 'Computer Science' },
      { name: 'Electrical' }
    ]);
    console.log('Seed data inserted');
    process.exit();
  });

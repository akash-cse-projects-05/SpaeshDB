const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sparsh';

mongoose.connect(uri)
  .then(async () => {
    const User = require('../src/models/User');
    const Doctor = require('../src/models/Doctor');
    
    const docs = await Doctor.find({});
    console.log(`--- DOCTORS (${docs.length}) ---`);
    docs.forEach(d => {
      console.log(JSON.stringify(d, null, 2));
    });
    
    const patients = await User.find({ role: 'patient' });
    console.log(`\n--- PATIENTS (${patients.length}) ---`);
    patients.forEach(p => {
      console.log(JSON.stringify(p, null, 2));
    });
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sparsh';

mongoose.connect(uri)
  .then(async () => {
    const User = require('../src/models/User');
    const Doctor = require('../src/models/Doctor');
    
    const doctors = await Doctor.find({});
    const patients = await User.find({ role: 'patient' });
    
    console.log('--- DOCTORS ---');
    doctors.forEach(d => console.log(`- Email: ${d.email} | Name: ${d.name}`));
    
    console.log('\n--- PATIENTS ---');
    patients.forEach(p => console.log(`- Email: ${p.email} | Name: ${p.name}`));
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sparsh';

mongoose.connect(uri)
  .then(async () => {
    const Appointment = require('../src/models/Appointment');
    const apps = await Appointment.find({}).populate('patientId').populate('doctorId');
    console.log(`Found ${apps.length} appointments.`);
    apps.slice(0, 5).forEach((app, i) => {
      console.log(`\n[App ${i}]`);
      console.log('ID:', app._id);
      console.log('patientId:', app.patientId);
      console.log('patientName:', app.patientName);
      console.log('doctorId:', app.doctorId);
      console.log('doctorName:', app.doctorName);
      console.log('appointmentSlot:', app.appointmentSlot);
      console.log('date/time fields:', app.date, app.time);
      console.log('consultationType:', app.consultationType);
      console.log('serviceType:', app.serviceType);
    });
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

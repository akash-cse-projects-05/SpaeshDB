require('dotenv').config();
const mongoose = require('mongoose');
const Appointment = require('./src/models/Appointment');
const reminderService = require('./src/services/reminderService');
const connectDB = require('./src/config/db');

async function test() {
  await connectDB();
  const upcomingAppointments = await Appointment.find({
    status: 'Confirmed',
    reminderSent: false
  }).populate('doctorId');
  
  console.log("Appointments found:", upcomingAppointments.length);
  process.exit(0);
}
test();

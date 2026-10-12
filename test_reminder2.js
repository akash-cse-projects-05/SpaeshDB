require('dotenv').config();
const mongoose = require('mongoose');
const Appointment = require('./src/models/Appointment');
const connectDB = require('./src/config/db');

async function test() {
  await connectDB();
  const allAppointments = await Appointment.find({}).sort({createdAt: -1}).limit(5);
  console.log("Latest Appointments:", JSON.stringify(allAppointments, null, 2));
  process.exit(0);
}
test();

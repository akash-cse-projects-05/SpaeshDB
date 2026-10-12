const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sparsh';

async function testFlow() {
  console.log('🔗 Connecting to database...');
  await mongoose.connect(dbUri);
  console.log('✅ Connected.');

  // Import services and models
  const aiBookingService = require('../src/services/aiBookingService');
  const User = require('../src/models/User');
  const Doctor = require('../src/models/Doctor');
  const Appointment = require('../src/models/Appointment');

  // Let's ensure there's at least one approved doctor with free slots
  let doctorsList = await Doctor.find({ isApproved: true });
  if (doctorsList.length === 0) {
    console.log('🌱 Seeding an approved doctor for verification...');
    const doctor = new Doctor({
      name: 'Ramesh Kumar',
      email: 'ramesh@sparsh.org',
      password: 'password123',
      specialization: 'PEP',
      qualification: 'MD, MBBS',
      consultationFee: 450,
      isApproved: true,
      availability: [
        { date: new Date('2026-07-20'), time: '10:30 AM', isBooked: false },
        { date: new Date('2026-07-21'), time: '02:00 PM', isBooked: false }
      ]
    });
    await doctor.save();
    doctorsList = [doctor];
  } else {
    // Add a free slot to the first approved doctor just in case they have none
    const doctor = doctorsList[0];
    const hasFreeSlot = doctor.availability.some(s => !s.isBooked);
    if (!hasFreeSlot) {
      doctor.availability.push({ date: new Date('2026-07-25'), time: '11:00 AM', isBooked: false });
      await doctor.save();
    }
  }

  const testPhone = '19998887777';
  // Clear any existing session/user for this phone to start fresh
  await User.deleteOne({ phoneNumber: testPhone });
  
  console.log('\n--- SIMULATING WHATSAPP CHAT FLOW ---');

  // Step 1: User says "hi"
  console.log('\nUser: hi');
  let reply = await aiBookingService.handleIncomingMessage(testPhone, 'hi');
  console.log(`AI: ${reply}`);

  // Step 2: User says "BOOK"
  console.log('\nUser: BOOK');
  reply = await aiBookingService.handleIncomingMessage(testPhone, 'BOOK');
  console.log(`AI: ${reply}`);

  // Step 3: User says "ANONYMOUS"
  console.log('\nUser: ANONYMOUS');
  reply = await aiBookingService.handleIncomingMessage(testPhone, 'ANONYMOUS');
  console.log(`AI: ${reply}`);

  // Step 4: User selects "1" (PEP)
  console.log('\nUser: 1');
  reply = await aiBookingService.handleIncomingMessage(testPhone, '1');
  console.log(`AI: ${reply}`);

  // Step 5: User selects Doctor "1"
  console.log('\nUser: 1');
  reply = await aiBookingService.handleIncomingMessage(testPhone, '1');
  console.log(`AI: ${reply}`);

  // Step 6: User selects Slot "1"
  console.log('\nUser: 1');
  reply = await aiBookingService.handleIncomingMessage(testPhone, '1');
  console.log(`AI: ${reply}`);

  // Step 7: User confirms "CONFIRM"
  console.log('\nUser: CONFIRM');
  reply = await aiBookingService.handleIncomingMessage(testPhone, 'CONFIRM');
  console.log(`AI: ${reply}`);

  // Check database for created appointment
  const guestUser = await User.findOne({ phoneNumber: testPhone });
  if (guestUser) {
    const appt = await Appointment.findOne({ patientId: guestUser._id });
    console.log('\n--- VERIFICATION RESULT ---');
    if (appt) {
      console.log('✅ Success! Appointment created in database:');
      console.log(`- ID: ${appt._id}`);
      console.log(`- Patient ID: ${appt.patientId} (Anonymous: ${appt.isAnonymous})`);
      console.log(`- Doctor ID: ${appt.doctorId}`);
      console.log(`- Slot: ${appt.appointmentSlot.date} at ${appt.appointmentSlot.time}`);
    } else {
      console.log('❌ Failure! No appointment document found in database.');
    }
  }

  // Cleanup
  await mongoose.disconnect();
  console.log('🔌 Disconnected database.');
}

testFlow().catch(console.error);

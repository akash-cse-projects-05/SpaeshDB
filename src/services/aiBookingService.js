const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const whatsappService = require('./whatsappService');
const emailService = require('./emailService');

// Helper to normalize phone numbers
function formatPhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace('whatsapp:', '').replace('@c.us', '').trim();
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

exports.handleIncomingMessage = async (fromNumber, incomingText) => {
  const cleanPhone = formatPhone(fromNumber);
  const text = incomingText.trim();
  const lowerText = text.toLowerCase();

  // Find or create user associated with this phone number
  let user = await User.findOne({ phoneNumber: cleanPhone });
  if (!user) {
    // Generate truly unique guest credentials to prevent E11000 errors
    const uniqueId = require('crypto').randomBytes(6).toString('hex');
    user = new User({
      name: `WhatsApp Guest ${uniqueId.substring(0, 4)}`,
      email: `wa-${uniqueId}@sparsh.org`,
      password: `wa-guest-pwd-${uniqueId}`, // hashed by pre-save hook
      age: 25, // default placeholder
      contact: cleanPhone,
      phoneNumber: cleanPhone,
      isAnonymous: true, // default to anonymous
      role: 'patient',
      whatsappSession: {
        state: 'IDLE',
        tempBookingData: {}
      }
    });
    await user.save();
  }

  // Retrieve session state
  let session = user.whatsappSession || { state: 'IDLE', tempBookingData: {} };
  let reply = '';

  try {
    switch (session.state) {
      case 'IDLE':
        if (lowerText === 'book' || lowerText.includes('appointment') || lowerText.includes('schedule')) {
          session.state = 'AWAITING_ANONYMOUS';
          session.tempBookingData = {};
          reply = `Let's schedule your consultation. 🔒\n\nWould you like this session to be Anonymous (identity hidden from doctor) or Public (registered under your history)?\n\nReply with "ANONYMOUS" or "PUBLIC".`;
        } else {
          reply = `Welcome to Sparsh Touch of Care! ⚕️\nI am your AI scheduling assistant. You can book private medical consultations here.\n\nReply with *BOOK* to start your booking.`;
        }
        break;

      case 'AWAITING_ANONYMOUS':
        if (lowerText === 'anonymous') {
          session.tempBookingData = { isAnonymous: true };
          session.state = 'AWAITING_SPECIALIZATION';
          reply = `🔒 Booking mode: Anonymous.\n\nPlease select a specialization category by replying with the number:\n1. PEP (Emergency post-exposure within 72h)\n2. PrEP (Daily preventative plans)\n3. Counselling (General sexual health support)`;
        } else if (lowerText === 'public') {
          session.tempBookingData = { isAnonymous: false };
          session.state = 'AWAITING_SPECIALIZATION';
          reply = `📂 Booking mode: Public (linked to history).\n\nPlease select a specialization category by replying with the number:\n1. PEP (Emergency post-exposure within 72h)\n2. PrEP (Daily preventative plans)\n3. Counselling (General sexual health support)`;
        } else {
          reply = `Invalid option. Please reply with either *ANONYMOUS* or *PUBLIC*.`;
        }
        break;

      case 'AWAITING_SPECIALIZATION':
        let spec = '';
        if (text === '1' || lowerText.includes('pep')) {
          spec = 'PEP';
        } else if (text === '2' || lowerText.includes('prep')) {
          spec = 'PrEP';
        } else if (text === '3' || lowerText.includes('counselling') || lowerText.includes('counseling')) {
          spec = 'General Counselling';
        }

        if (spec) {
          session.tempBookingData.specialization = spec;
          
          // Query active approved doctors
          const doctors = await Doctor.find({ isApproved: true });
          if (doctors.length === 0) {
            reply = `We're sorry, there are no approved doctors available at the moment. Please reply *BOOK* to try again later.`;
            session.state = 'IDLE';
          } else {
            session.state = 'AWAITING_DOCTOR';
            session.tempBookingData.doctorsList = doctors.map(d => ({ id: d._id.toString(), name: d.name }));
            
            let docListText = `Please select an expert doctor by replying with their number:\n`;
            doctors.forEach((doc, idx) => {
              docListText += `${idx + 1}. Dr. ${doc.name} (${doc.qualification} - Fee: ₹${doc.consultationFee})\n`;
            });
            reply = docListText;
          }
        } else {
          reply = `Please reply with a valid number: *1* for PEP, *2* for PrEP, or *3* for Counselling.`;
        }
        break;

      case 'AWAITING_DOCTOR':
        const docIdx = parseInt(text) - 1;
        const savedDocs = session.tempBookingData.doctorsList || [];
        
        if (!isNaN(docIdx) && docIdx >= 0 && docIdx < savedDocs.length) {
          const selectedDoc = savedDocs[docIdx];
          session.tempBookingData.doctorId = selectedDoc.id;
          session.tempBookingData.doctorName = selectedDoc.name;
          delete session.tempBookingData.doctorsList; // Clean up list
          
          // Query doctor's free availability slots
          const doctorObj = await Doctor.findById(selectedDoc.id);
          if (!doctorObj) {
            reply = `Doctor profile not found. Please reply *BOOK* to try again.`;
            session.state = 'IDLE';
            break;
          }
          
          const freeSlots = doctorObj.availability.filter(slot => !slot.isBooked);
          if (freeSlots.length === 0) {
            reply = `Dr. ${doctorObj.name} has no available slots at the moment. Please reply *BOOK* to select another doctor or try again later.`;
            session.state = 'IDLE';
            break;
          }
          
          // Save slot options in temporary session data
          session.tempBookingData.slotsList = freeSlots.map(s => ({
            id: s._id.toString(),
            date: s.date,
            time: s.time
          }));
          
          session.state = 'AWAITING_SLOT';
          let slotListText = `Selected: Dr. ${doctorObj.name}.\n\nPlease choose a slot by replying with the number:\n`;
          freeSlots.forEach((slot, idx) => {
            let dateStr = 'N/A';
            try {
              dateStr = new Date(slot.date).toISOString().split('T')[0];
            } catch(e) {}
            slotListText += `${idx + 1}. Date: ${dateStr} at Time: ${slot.time}\n`;
          });
          reply = slotListText;
        } else {
          let errorText = `Invalid selection. Please reply with the number corresponding to your doctor choice:\n`;
          savedDocs.forEach((doc, idx) => {
            errorText += `${idx + 1}. Dr. ${doc.name}\n`;
          });
          reply = errorText;
        }
        break;

      case 'AWAITING_SLOT':
        const slotIdx = parseInt(text) - 1;
        const savedSlots = session.tempBookingData.slotsList || [];
        
        if (!isNaN(slotIdx) && slotIdx >= 0 && slotIdx < savedSlots.length) {
          const selectedSlot = savedSlots[slotIdx];
          session.tempBookingData.slotId = selectedSlot.id;
          try {
            session.tempBookingData.date = new Date(selectedSlot.date).toISOString().split('T')[0];
          } catch(e) {
            session.tempBookingData.date = selectedSlot.date.toString();
          }
          session.tempBookingData.time = selectedSlot.time;
          delete session.tempBookingData.slotsList; // Clean up list
          
          session.state = 'AWAITING_CONFIRMATION';
          const booking = session.tempBookingData;
          reply = `Please confirm your appointment details:\n\n` +
                  `👤 Mode: ${booking.isAnonymous ? '🔒 Anonymous' : '📂 Public (Show Name)'}\n` +
                  `Category: ${booking.specialization}\n` +
                  `Specialist: Dr. ${booking.doctorName}\n` +
                  `Slot: ${booking.date} at ${booking.time}\n\n` +
                  `Reply *CONFIRM* to schedule or *CANCEL* to start over.`;
        } else {
          let errorText = `Invalid selection. Please reply with the number of your preferred slot:\n`;
          savedSlots.forEach((slot, idx) => {
            let dateStr = 'N/A';
            try {
              dateStr = new Date(slot.date).toISOString().split('T')[0];
            } catch(e) {}
            errorText += `${idx + 1}. Date: ${dateStr} at Time: ${slot.time}\n`;
          });
          reply = errorText;
        }
        break;

      case 'AWAITING_CONFIRMATION':
        if (lowerText === 'confirm') {
          const booking = session.tempBookingData;
          const doctorObj = await Doctor.findById(booking.doctorId);
          
          if (!doctorObj) {
            reply = `The selected doctor is no longer available. Please reply *BOOK* to start over.`;
            session.state = 'IDLE';
            break;
          }

          // Atomic verify and lock availability slot
          const slot = doctorObj.availability.id(booking.slotId);
          if (!slot || slot.isBooked) {
            reply = `The selected slot has already been booked or is unavailable. Please reply *BOOK* to select another slot.`;
            session.state = 'IDLE';
            break;
          }
          slot.isBooked = true;
          await doctorObj.save();

          // Create the Mongoose Appointment
          const appointment = new Appointment({
            patientId: user._id,
            doctorId: doctorObj._id,
            patientName: booking.isAnonymous ? 'Anonymous Patient' : user.name,
            doctorName: doctorObj.name,
            consultationType: booking.specialization,
            consultationMode: 'Video Consultation', // Default consult mode
            appointmentSlot: {
              date: slot.date,
              time: slot.time
            },
            paymentDetails: {
              amount: doctorObj.consultationFee || 0,
              currency: 'INR',
              transactionId: 'whatsapp_bot_simulated',
              status: 'Paid'
            },
            patientContact: {
              method: 'Phone',
              value: cleanPhone
            },
            status: 'Confirmed', // Mark confirmed since slot is locked
            isAnonymous: booking.isAnonymous
          });

          await appointment.save();

          // Auto-assign primary care doctor if not already assigned
          if (!user.primaryDoctorId) {
            user.primaryDoctorId = doctorObj._id;
          }

          // Reset user state
          session.state = 'IDLE';
          session.tempBookingData = {};

          reply = `✅ Appointment successfully booked! Your secure consultation slot is scheduled for ${booking.date} at ${booking.time}.\n\nLog in to the Sparsh portal anytime to access your dashboard.`;

          // Notify the doctor via Email and WhatsApp asynchronously
          const docEmail = doctorObj.email || 'doctor@sparsh.org';
          const docPhone = doctorObj.phoneNumber || null;

          const docNotifyMsg = `📅 New Sparsh Appointment Alert!\n\nPatient: ${booking.isAnonymous ? 'Anonymous Patient' : user.name}\nSlot: ${booking.date} at ${booking.time}\nMode: ${booking.specialization}\n\nPlease check your Sparsh doctor dashboard to log in.`;
          
          emailService.sendAppointmentNotification(
            docEmail,
            doctorObj.name,
            booking.isAnonymous ? 'Anonymous Patient' : user.name,
            booking.date,
            booking.time,
            booking.specialization,
            'Booked via AI WhatsApp Bot'
          );

          if (docPhone) {
            whatsappService.sendWhatsAppMessage(docPhone, docNotifyMsg);
          }

        } else if (lowerText === 'cancel') {
          session.state = 'IDLE';
          session.tempBookingData = {};
          reply = `Booking cancelled. Send *BOOK* anytime if you want to start a new reservation.`;
        } else {
          reply = `Please reply with *CONFIRM* to schedule your appointment or *CANCEL* to cancel.`;
        }
        break;

      default:
        session.state = 'IDLE';
        reply = `Something went wrong. Let's start over. Reply with *BOOK* to schedule an appointment.`;
        break;
    }
  } catch (err) {
    console.error('❌ Error handling WhatsApp booking flow:', err);
    session.state = 'IDLE';
    reply = `An error occurred while processing your request. Please type *BOOK* to start over.`;
  }

  // Update session state in DB
  user.whatsappSession = session;
  user.markModified('whatsappSession');
  await user.save();

  // Return the reply so the caller (webhook or native WA) can send it directly
  return reply;
};

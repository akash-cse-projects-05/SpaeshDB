const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const emailService = require('../services/emailService');
const whatsappService = require('../services/whatsappService');

// Fetch patient dashboard
exports.getDashboard = async (req, res) => {
  try {
    // Find all appointments for this patient
    const appointments = await Appointment.find({ patientId: req.user._id })
      .populate('doctorId', 'name specialization qualification')
      .sort({ createdAt: -1 });

    if (req.user.primaryDoctorId) {
      await req.user.populate('primaryDoctorId', 'name specialization');
    }

    // Also fetch doctors for the inline booking widget
    const doctors = await Doctor.find({ isApproved: true }).select('name specialization qualification availability consultationFee gender');

    res.render('patient/dashboard', {
      title: 'Patient Dashboard - Sparsh',
      appointments,
      doctors
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to retrieve dashboard details.');
    res.redirect('/');
  }
};

// Render booking form
exports.getBook = async (req, res) => {
  try {
    const doctors = await Doctor.find({ isApproved: true }).select('name specialization qualification availability consultationFee gender');
    res.render('patient/book', {
      title: 'Book a Consultation - Sparsh',
      doctors
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to fetch clinical consultants.');
    res.redirect('/patient/dashboard');
  }
};

// Handle booking submission with mockup payment confirmation
exports.postBook = async (req, res) => {
  const { doctorId, consultationType, consultationMode, date, time, contactMethod, contactValue, transactionId, amount } = req.body;

  const validServices = ['PEP', 'PrEP', 'General Counselling'];
  const validModes = ['Video Consultation', 'Phone Consultation', 'Text Chat'];
  if (!doctorId || !date || !time || !validServices.includes(consultationType) || !validModes.includes(consultationMode) || !contactValue) {
    req.flash('error', 'Please complete the booking form with a valid service, mode, and slot.');
    return res.redirect('/patient/book');
  }

  try {
    // Atomically find a doctor with the specific slot that is not booked and mark it as booked.
    const doctor = await Doctor.findOneAndUpdate(
      { 
        _id: doctorId, 
        isApproved: true,
        availability: { $elemMatch: { date: new Date(date), time: time, isBooked: false } }
      },
      {
        $set: { "availability.$.isBooked": true }
      },
      { new: true } // Return updated doc
    );

    if (!doctor) {
      req.flash('error', 'The selected doctor or slot is not available. Please try another.');
      return res.redirect('/patient/book');
    }

    const appointment = new Appointment({
      patientId: req.user._id,
      doctorId: doctorId,
      consultationType,
      consultationMode: consultationMode || 'Video Consultation',
      appointmentSlot: {
        date,
        time
      },
      patientHistory: `Primary service requested: ${consultationType}. Communication details provided.`,
      patientContact: {
        method: contactMethod || 'Email',
        value: contactValue || 'Not provided'
      },
      paymentDetails: {
        amount: parseFloat(amount) || 500,
        transactionId: transactionId || `TXN-${Date.now()}`,
        status: 'Paid'
      },
      status: 'Pending' // Initial state is Pending until Doctor confirms
    });

    await appointment.save();

    // Auto-assign primary care doctor if not already assigned
    if (!req.user.primaryDoctorId) {
      await User.findByIdAndUpdate(req.user._id, { primaryDoctorId: doctorId });
      req.user.primaryDoctorId = doctorId;
    }

    // Send actual notifications
    const patientName = appointment.isAnonymous ? 'Anonymous Patient' : req.user.name;
    const acceptLink = `${process.env.APP_URL || 'http://localhost:3001'}/appointments/${appointment._id}/confirm`;
    const declineLink = `${process.env.APP_URL || 'http://localhost:3001'}/appointments/${appointment._id}/cancel`;

    const whatsappMsg = `📅 New Sparsh Appointment Alert!\n\nHello Dr. ${doctor.name}, a patient (${patientName}) has requested a ${consultationType} consultation on Sparsh for ${date} at ${time}.\n\nReply directly to this WhatsApp chat:\n1️⃣ Reply "1" or "ACCEPT" to Approve\n2️⃣ Reply "2" or "DECLINE" to Reject`;

    // Send email to doctor
    emailService.sendAppointmentNotification(
      doctor.email,
      doctor.name,
      patientName,
      date,
      time,
      consultationType,
      `Requested communication method: ${contactMethod || 'Email'} (${contactValue || 'Not provided'})`
    );

    // Send WhatsApp message to doctor
    const docPhone = doctor.phoneNumber || process.env.TWILIO_WHATSAPP_NUMBER;
    if (docPhone) {
      whatsappService.sendWhatsAppMessage(docPhone, whatsappMsg);
    }

    // Send automatic WhatsApp confirmation message to patient
    if (contactMethod === 'WhatsApp' && contactValue) {
      const patientMsg = `📅 Sparsh Booking Requested!\n\nHello ${patientName},\nYour ${consultationType} consultation request with Dr. ${doctor.name} for ${date} at ${time} has been received. We will update you as soon as it's confirmed.`;
      whatsappService.sendWhatsAppMessage(contactValue, patientMsg);
    }

    res.redirect(`/patient/booking-confirmed/${appointment._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'An error occurred during booking. Please try again.');
    res.redirect('/patient/book');
  }
};

// Render the post-payment confirmation shown at the end of the booking flow.
exports.getBookingConfirmation = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      patientId: req.user._id
    }).populate('doctorId', 'name specialization');

    if (!appointment) {
      req.flash('error', 'Booking confirmation was not found.');
      return res.redirect('/patient/dashboard');
    }

    res.render('patient/confirmation', {
      title: 'Booking Confirmed - Sparsh',
      appointment
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load your booking confirmation.');
    res.redirect('/patient/dashboard');
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PrEP ADHERENCE TRACKER
// ──────────────────────────────────────────────────────────────────────────────

// GET /patient/prep-tracker  — render the calendar
exports.getPrepTracker = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const prep = user.prepTracking || { isActive: false, currentStreak: 0, adherenceLog: [] };
    res.render('patient/prepTracker', {
      title: 'PrEP Adherence Tracker – Sparsh',
      prep
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load tracker.');
    res.redirect('/patient/dashboard');
  }
};

// POST /patient/prep-tracker/activate — start PrEP plan
exports.postActivatePrepTracker = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      'prepTracking.isActive': true,
      'prepTracking.startDate': new Date(),
      'prepTracking.currentStreak': 0,
      'prepTracking.adherenceLog': []
    });
    req.flash('success', 'PrEP tracking activated! Remember to mark your daily dose.');
    res.redirect('/patient/prep-tracker');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not activate tracker.');
    res.redirect('/patient/prep-tracker');
  }
};

// POST /patient/prep-tracker/log — toggle a day's dose
exports.postLogPrepDose = async (req, res) => {
  const { date } = req.body; // YYYY-MM-DD string
  try {
    const user = await User.findById(req.user._id);
    const log = user.prepTracking.adherenceLog || [];
    const existing = log.find(e => e.date === date);
    if (existing) {
      existing.taken = !existing.taken; // toggle
    } else {
      log.push({ date, taken: true });
    }

    // Recalculate streak
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = today;
    while (true) {
      const entry = log.find(e => e.date === checkDate);
      if (entry && entry.taken) {
        streak++;
        const d = new Date(checkDate);
        d.setDate(d.getDate() - 1);
        checkDate = d.toISOString().split('T')[0];
      } else break;
    }

    user.prepTracking.adherenceLog = log;
    user.prepTracking.currentStreak = streak;
    user.markModified('prepTracking');
    await user.save();

    res.json({ success: true, streak });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not log dose.' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PEP EXPOSURE DATE SETTER
// ──────────────────────────────────────────────────────────────────────────────

exports.postSetPepExposure = async (req, res) => {
  const { exposureDate } = req.body;
  try {
    await User.findByIdAndUpdate(req.user._id, {
      pepExposureDate: new Date(exposureDate)
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save exposure date.' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PEP EMERGENCY AUTO-MATCH ENGINE
// ──────────────────────────────────────────────────────────────────────────────

exports.postAutoMatchPep = async (req, res) => {
  const { contactValue, contactMethod, transactionId, amount } = req.body;
  try {
    // Find earliest available PEP doctor
    const pepDoctors = await Doctor.find({
      isApproved: true,
      availability: { $elemMatch: { isBooked: false } }
    }).sort({ 'availability.date': 1 });

    if (!pepDoctors.length) {
      req.flash('error', 'No PEP specialists available right now. Please try a manual booking or call emergency helpline.');
      return res.redirect('/patient/book');
    }

    let chosenDoctor = null;
    let chosenSlot = null;

    for (const doc of pepDoctors) {
      const freeSlots = doc.availability.filter(s => !s.isBooked);
      if (freeSlots.length > 0) {
        const sorted = freeSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
        chosenDoctor = doc;
        chosenSlot = sorted[0];
        break;
      }
    }

    if (!chosenDoctor || !chosenSlot) {
      req.flash('error', 'Unable to find an available slot. Please book manually.');
      return res.redirect('/patient/book');
    }

    // Lock the slot atomically
    const locked = await Doctor.findOneAndUpdate(
      {
        _id: chosenDoctor._id,
        availability: { $elemMatch: { _id: chosenSlot._id, isBooked: false } }
      },
      { $set: { 'availability.$.isBooked': true } },
      { new: true }
    );

    if (!locked) {
      req.flash('error', 'Slot was just taken. Please try again.');
      return res.redirect('/patient/book');
    }

    const slotDate = new Date(chosenSlot.date).toISOString().split('T')[0];

    const appointment = new Appointment({
      patientId: req.user._id,
      doctorId: chosenDoctor._id,
      consultationType: 'PEP',
      consultationMode: 'Video Consultation',
      appointmentSlot: { date: chosenSlot.date, time: chosenSlot.time },
      patientHistory: '⚡ Emergency PEP Auto-Match. Patient initiated urgent booking.',
      patientContact: {
        method: contactMethod || 'Email',
        value: contactValue || req.user.email
      },
      paymentDetails: {
        amount: parseFloat(amount) || chosenDoctor.consultationFee || 500,
        transactionId: transactionId || `PEP-AUTO-${Date.now()}`,
        status: 'Paid'
      },
      status: 'Confirmed' // Auto-confirmed for emergencies
    });

    await appointment.save();

    // Auto-assign primary care doctor if not already assigned
    if (!req.user.primaryDoctorId) {
      await User.findByIdAndUpdate(req.user._id, { primaryDoctorId: chosenDoctor._id });
      req.user.primaryDoctorId = chosenDoctor._id;
    }

    // Notify doctor
    emailService.sendAppointmentNotification(
      chosenDoctor.email,
      chosenDoctor.name,
      req.user.isAnonymous ? 'Anonymous Patient (Emergency)' : req.user.name,
      slotDate,
      chosenSlot.time,
      'PEP – Emergency Auto-Match',
      'URGENT: Patient initiated emergency PEP booking via auto-match system.'
    );

    req.flash('success', `🚨 Emergency PEP slot auto-booked with Dr. ${chosenDoctor.name} on ${slotDate} at ${chosenSlot.time}. Your appointment is confirmed.`);
    res.redirect(`/patient/booking-confirmed/${appointment._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Auto-match failed. Please book manually.');
    res.redirect('/patient/book');
  }
};

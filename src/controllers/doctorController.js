const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');

// ─── GET Doctor Dashboard ───────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const appointments = await Appointment.find({ doctorId: req.user._id })
      .populate('patientId', 'name email contact age isAnonymous primaryDoctorId')
      .sort({ createdAt: -1 });

    // Fetch fresh doctor with slots
    const doctor = await Doctor.findById(req.user._id);

    // Calculate Total Revenue from Paid appointments
    let totalRevenue = 0;
    appointments.forEach(app => {
      if (app.paymentDetails && app.paymentDetails.status === 'Paid') {
        totalRevenue += (app.paymentDetails.amount || 0);
      }
    });

    res.render('doctor/dashboard', {
      title: 'Doctor Portal – Sparsh',
      appointments,
      doctor,
      totalRevenue
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to retrieve portal details.');
    res.redirect('/');
  }
};

// ─── GET Doctor Profile ─────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user._id);
    res.render('doctor/profile', {
      title: 'Professional Profile – Sparsh',
      doctor
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to retrieve profile.');
    res.redirect('/doctor/dashboard');
  }
};

// ─── POST Add Availability Slot ─────────────────────────────────────────────
exports.postAddSlot = async (req, res) => {
  const { date, startTime, endTime } = req.body;
  if (!date || !startTime || !endTime) {
    req.flash('error', 'Date, start time, and end time are required.');
    return res.redirect('/doctor/dashboard?tab=availability');
  }
  
  const time = `${startTime} - ${endTime}`;

  try {
    await Doctor.findByIdAndUpdate(req.user._id, {
      $push: {
        availability: { date: new Date(date), time, isBooked: false }
      }
    });
    req.flash('success', 'Slot Added – Your availability has been updated.');
    res.redirect('/doctor/dashboard?tab=availability');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add slot.');
    res.redirect('/doctor/dashboard?tab=availability');
  }
};

// ─── POST Add Bulk & Recurring Availability Slots ────────────────────────────
exports.postBulkSlots = async (req, res) => {
  const { date, startTime, endTime, durationMinutes, repeatWeeks, daysOfWeek } = req.body;
  if (!date || !startTime || !endTime) {
    req.flash('error', 'Date, start time, and end time are required for schedule generation.');
    return res.redirect('/doctor/dashboard?tab=availability');
  }

  const duration = parseInt(durationMinutes, 10) || 30;
  const numWeeks = Math.min(Math.max(parseInt(repeatWeeks, 10) || 1, 1), 8); // 1 to 8 weeks max

  try {
    const parseMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const formatTime = (totalMin) => {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      const period = h >= 12 ? 'PM' : 'AM';
      const formattedH = h % 12 === 0 ? 12 : h % 12;
      return `${formattedH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
    };

    const initialStartMin = parseMinutes(startTime);
    const endMin = parseMinutes(endTime);

    if (initialStartMin >= endMin) {
      req.flash('error', 'Start time must be earlier than end time.');
      return res.redirect('/doctor/dashboard?tab=availability');
    }

    // Determine target dates
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const targetDates = [];
    const selectedDays = Array.isArray(daysOfWeek)
      ? daysOfWeek.map(Number)
      : daysOfWeek !== undefined ? [Number(daysOfWeek)] : [];

    if (selectedDays.length > 0 && numWeeks >= 1) {
      // Recurring mode: generate dates across N weeks matching selected days of week
      const totalDays = numWeeks * 7;
      for (let i = 0; i < totalDays; i++) {
        const curDate = new Date(startDate);
        curDate.setDate(startDate.getDate() + i);
        if (selectedDays.includes(curDate.getDay())) {
          targetDates.push(curDate);
        }
      }
    } else {
      // Single date bulk mode
      targetDates.push(startDate);
    }

    if (targetDates.length === 0) {
      req.flash('error', 'No valid dates selected for schedule generation.');
      return res.redirect('/doctor/dashboard?tab=availability');
    }

    const newSlots = [];
    for (const targetDate of targetDates) {
      let curStart = initialStartMin;
      while (curStart + duration <= endMin) {
        const slotTimeStr = `${formatTime(curStart)} - ${formatTime(curStart + duration)}`;
        newSlots.push({
          date: new Date(targetDate),
          time: slotTimeStr,
          isBooked: false
        });
        curStart += duration;
      }
    }

    if (newSlots.length === 0) {
      req.flash('error', 'No slots could be generated within the given time window.');
      return res.redirect('/doctor/dashboard?tab=availability');
    }

    await Doctor.findByIdAndUpdate(req.user._id, {
      $push: { availability: { $each: newSlots } }
    });

    req.flash('success', `Successfully generated ${newSlots.length} consultation slots across ${targetDates.length} day(s)!`);
    res.redirect('/doctor/dashboard?tab=availability');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to generate availability slots.');
    res.redirect('/doctor/dashboard?tab=availability');
  }
};

// ─── POST Delete Availability Slot ──────────────────────────────────────────
exports.postDeleteSlot = async (req, res) => {
  const { slotId } = req.body;
  if (!slotId) {
    req.flash('error', 'Invalid slot.');
    return res.redirect('/doctor/dashboard?tab=availability');
  }

  try {
    const doctor = await Doctor.findById(req.user._id);
    const slot = doctor.availability.id(slotId);
    if (!slot) {
      req.flash('error', 'Slot not found.');
      return res.redirect('/doctor/dashboard?tab=availability');
    }
    if (slot.isBooked) {
      req.flash('error', 'Cannot delete a slot that is already booked.');
      return res.redirect('/doctor/dashboard?tab=availability');
    }

    await Doctor.findByIdAndUpdate(req.user._id, {
      $pull: { availability: { _id: slotId } }
    });
    req.flash('success', 'Slot removed.');
    res.redirect('/doctor/dashboard?tab=availability');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete slot.');
    res.redirect('/doctor/dashboard?tab=availability');
  }
};

// ─── POST Clear Expired / Unbooked Past Slots ────────────────────────────────
exports.postClearExpiredSlots = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Doctor.findByIdAndUpdate(req.user._id, {
      $pull: {
        availability: {
          date: { $lt: today },
          isBooked: false
        }
      }
    });

    req.flash('success', 'Cleared all expired unbooked slots from your calendar.');
    res.redirect('/doctor/dashboard?tab=availability');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to clear expired slots.');
    res.redirect('/doctor/dashboard?tab=availability');
  }
};

// ─── POST Clear Unbooked Slots for Specific Date ─────────────────────────────
exports.postClearDaySlots = async (req, res) => {
  const { date } = req.body;
  if (!date) {
    req.flash('error', 'Date is required.');
    return res.redirect('/doctor/dashboard?tab=availability');
  }

  try {
    const targetDate = new Date(date);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    await Doctor.findByIdAndUpdate(req.user._id, {
      $pull: {
        availability: {
          date: { $gte: targetDate, $lt: nextDate },
          isBooked: false
        }
      }
    });

    req.flash('success', 'Cleared unbooked slots for the selected date.');
    res.redirect('/doctor/dashboard?tab=availability');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to clear day slots.');
    res.redirect('/doctor/dashboard?tab=availability');
  }
};

// ─── POST Update Profile ────────────────────────────────────────────────────
exports.postUpdateProfile = async (req, res) => {
  const { name, specialization, consultationFee, bio, gender } = req.body;

  try {
    await Doctor.findByIdAndUpdate(req.user._id, {
      name: name ? name.trim() : req.user.name,
      specialization: specialization ? specialization.trim() : req.user.specialization,
      consultationFee: consultationFee ? Number(consultationFee) : req.user.consultationFee,
      bio: bio ? bio.trim() : req.user.bio,
      gender: gender || req.user.gender
    });
    req.flash('success', 'Profile updated successfully.');
    res.redirect('/doctor/profile');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update profile.');
    res.redirect('/doctor/profile');
  }
};

// ─── POST Confirm / Cancel Appointment (doctor action) ─────────────────────
exports.postAppointmentAction = async (req, res) => {
  const { appointmentId, action } = req.body;
  const validActions = ['confirmed', 'cancelled'];
  if (!appointmentId || !validActions.includes(action)) {
    req.flash('error', 'Invalid action.');
    return res.redirect('/doctor/dashboard');
  }

  try {
    await Appointment.findOneAndUpdate(
      { _id: appointmentId, doctorId: req.user._id },
      { status: action === 'confirmed' ? 'Confirmed' : 'Cancelled' },
    );
    const label = action === 'confirmed' ? 'Appointment confirmed.' : 'Appointment cancelled.';
    req.flash('success', label);
    res.redirect('/doctor/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update appointment.');
    res.redirect('/doctor/dashboard');
  }
};

// ─── GET Payouts Page ───────────────────────────────────────────────────────
exports.getPayouts = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user._id);
    
    // Fetch only paid appointments
    const paidAppointments = await Appointment.find({ 
      doctorId: req.user._id,
      'paymentDetails.status': 'Paid'
    })
    .populate('patientId', 'name email')
    .sort({ createdAt: -1 });

    let totalRevenue = 0;
    paidAppointments.forEach(app => {
      totalRevenue += (app.paymentDetails.amount || 0);
    });

    res.render('doctor/payouts', {
      title: 'Payouts & Revenue – Sparsh',
      doctor,
      paidAppointments,
      totalRevenue
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to retrieve payouts.');
    res.redirect('/doctor/dashboard');
  }
};

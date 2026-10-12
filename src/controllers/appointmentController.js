const Appointment = require('../models/Appointment');
const User = require('../models/User');
const emailService = require('../services/emailService');

// View individual appointment file & communication logs
exports.getAppointmentDetails = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name email age contact isAnonymous role prepTracking')
      .populate('doctorId', 'name specialization qualification email');

    if (!appointment) {
      req.flash('error', 'Appointment record not found.');
      return res.redirect('/');
    }

    // Authorization checks: Patient or Doctor or Admin
    const isPatient = req.user.role === 'patient' && appointment.patientId._id.toString() === req.user._id.toString();
    const isDoctor = req.user.role === 'doctor' && appointment.doctorId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isDoctor && !isAdmin) {
      req.flash('error', 'Unauthorized access to clinical documents.');
      return res.redirect('/');
    }

    res.render('appointments/details', {
      title: `Consultation File - ${appointment.consultationType}`,
      appointment,
      role: req.user.role
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to retrieve appointment files.');
    res.redirect('/');
  }
};

// Add chat message
exports.postAddMessage = async (req, res) => {
  const { content, isEncrypted } = req.body;
  
  if (!content || content.trim() === '') {
    req.flash('error', 'Message cannot be empty.');
    return res.redirect(`/appointments/${req.params.id}`);
  }

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      req.flash('error', 'Appointment not found.');
      return res.redirect('/');
    }

    const isPatient = req.user.role === 'patient' && appointment.patientId.toString() === req.user._id.toString();
    const isDoctor = req.user.role === 'doctor' && appointment.doctorId.toString() === req.user._id.toString();
    if (!isPatient && !isDoctor) {
      req.flash('error', 'You cannot message this consultation.');
      return res.redirect('/');
    }

    const senderRole = isDoctor ? 'doctor' : 'patient';
    
    appointment.messages.push({
      sender: senderRole,
      content: content.trim(),
      isEncrypted: isEncrypted === 'true' || isEncrypted === true,
      timestamp: new Date()
    });

    await appointment.save();
    
    // Also trigger email alerts to the recipient
    const recipientEmail = isDoctor 
      ? (appointment.patientContact?.value || 'patient@sparsh.org') 
      : (appointment.doctorId ? appointment.doctorId.email : 'doctor@sparsh.org');
    
    if (recipientEmail && recipientEmail.includes('@')) {
      emailService.sendAppointmentNotification(
        recipientEmail,
        isDoctor ? 'Patient' : 'Dr. ' + appointment.doctorName,
        isDoctor ? 'System Notification' : (appointment.isAnonymous ? 'Anonymous Patient' : req.user.name),
        appointment.appointmentSlot.date.toISOString().split('T')[0],
        appointment.appointmentSlot.time,
        appointment.consultationType,
        `New follow-up message received: ${isEncrypted ? '🔒 [Encrypted Message]' : content.substring(0, 50) + '...'}`
      );
    }

    res.redirect(`/appointments/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Message delivery failed.');
    res.redirect(`/appointments/${req.params.id}`);
  }
};

// Update medical prescription (Doctors only)
exports.postUpdatePrescription = async (req, res) => {
  const { notes, medication, dosage } = req.body;

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      req.flash('error', 'Appointment not found.');
      return res.redirect('/');
    }

    // Ensure it's the doctor of this appointment
    if (req.user.role !== 'doctor' || appointment.doctorId.toString() !== req.user._id.toString()) {
      req.flash('error', 'Action prohibited. Doctor access only.');
      return res.redirect(`/appointments/${req.params.id}`);
    }

    appointment.prescription = {
      notes: notes || '',
      medication: medication || '',
      dosage: dosage || '',
      updatedAt: new Date()
    };

    // Update status to Completed once a prescription is issued, if appropriate
    if (appointment.status === 'Confirmed') {
      appointment.status = 'Completed';
    }

    await appointment.save();

    // Notify patient
    const patientEmail = appointment.patientContact?.value;
    if (patientEmail && patientEmail.includes('@')) {
      emailService.sendAppointmentNotification(
        patientEmail,
        appointment.patientName || 'Patient',
        'Dr. ' + (appointment.doctorName || 'Specialist'),
        appointment.appointmentSlot.date.toISOString().split('T')[0],
        appointment.appointmentSlot.time,
        appointment.consultationType,
        `A digital prescription has been issued: ${medication}. Log in to view detailed directives and PIN.`
      );
    }

    req.flash('success', 'Digital prescription issued and patient profile updated.');
    res.redirect(`/appointments/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update prescription details.');
    res.redirect(`/appointments/${req.params.id}`);
  }
};

// Update status directly (e.g. from dropdown)
exports.postUpdateStatus = async (req, res) => {
  const { status } = req.body;
  const allowedStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

  if (!allowedStatuses.includes(status)) {
    req.flash('error', 'Invalid appointment status.');
    return res.redirect(`/appointments/${req.params.id}`);
  }

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      req.flash('error', 'Appointment not found.');
      return res.redirect('/');
    }

    // Verify role permissions
    const isDoctor = req.user.role === 'doctor' && appointment.doctorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isDoctor && !isAdmin) {
      req.flash('error', 'Unauthorized privilege action.');
      return res.redirect(`/appointments/${req.params.id}`);
    }

    appointment.status = status;
    await appointment.save();
    
    // Free the doctor's slot if cancelled
    if (status === 'Cancelled') {
      const Doctor = require('../models/Doctor');
      await Doctor.findOneAndUpdate(
        { 
          _id: appointment.doctorId,
          availability: { $elemMatch: { date: new Date(appointment.appointmentSlot.date), time: appointment.appointmentSlot.time } }
        },
        {
          $set: { "availability.$.isBooked": false }
        }
      );
    }

    req.flash('success', `Appointment status updated to "${status}".`);

    // Notify patient via Email and WhatsApp
    const patientContact = appointment.patientContact?.value;
    if (patientContact) {
      if (patientContact.includes('@')) {
        emailService.sendAppointmentNotification(
          patientContact,
          appointment.patientName || 'Patient',
          'Dr. ' + (appointment.doctorName || 'Specialist'),
          appointment.appointmentSlot.date.toISOString().split('T')[0],
          appointment.appointmentSlot.time,
          appointment.consultationType,
          `Your appointment status has been updated to: ${status}.`
        );
      } else {
        const whatsappService = require('../services/whatsappService');
        const statusMsg = `📅 Sparsh Alert: Hello, your consultation status with Sparsh Healthcare has been updated to: *${status}*.`;
        whatsappService.sendWhatsAppMessage(patientContact, statusMsg);
      }
    }

    res.redirect(`/appointments/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Status modification failed.');
    res.redirect(`/appointments/${req.params.id}`);
  }
};



// Cancel appointment POST route
exports.postCancel = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      req.flash('error', 'Appointment not found.');
      return res.redirect('/');
    }

    const isPatient = req.user.role === 'patient' && appointment.patientId.toString() === req.user._id.toString();
    const isDoctor = req.user.role === 'doctor' && appointment.doctorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isPatient && !isDoctor && !isAdmin) {
      req.flash('error', 'Unauthorized action.');
      return res.redirect('/');
    }

    appointment.status = 'Cancelled';
    await appointment.save();

    // Free the doctor's slot
    const Doctor = require('../models/Doctor');
    await Doctor.findOneAndUpdate(
      { 
        _id: appointment.doctorId,
        availability: { $elemMatch: { date: new Date(appointment.appointmentSlot.date), time: appointment.appointmentSlot.time } }
      },
      {
        $set: { "availability.$.isBooked": false }
      }
    );

    if (appointment.patientContact && appointment.patientContact.value) {
      const whatsappService = require('../services/whatsappService');
      const cancelMsg = `⚠️ Sparsh Alert: Hello, your scheduled consultation for ${new Date(appointment.appointmentSlot.date).toISOString().split('T')[0]} at ${appointment.appointmentSlot.time} has been cancelled.`;
      whatsappService.sendWhatsAppMessage(appointment.patientContact.value, cancelMsg);
    }

    req.flash('success', 'Consultation cancelled successfully.');
    if (req.user.role === 'doctor') {
      res.redirect('/doctor/dashboard');
    } else if (req.user.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else {
      res.redirect('/patient/dashboard');
    }
  } catch (err) {
    console.error(err);
    req.flash('error', 'Cancellation failed.');
    res.redirect('back');
  }
};

// Direct GET link confirmation from WhatsApp alert
exports.getConfirm = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      req.flash('error', 'Appointment not found.');
      return res.redirect('/');
    }
    appointment.status = 'Confirmed';
    await appointment.save();

    if (appointment.patientContact && appointment.patientContact.value) {
      const whatsappService = require('../services/whatsappService');
      const confirmMsg = `✅ Sparsh Alert: Great news! Your appointment has been CONFIRMED by Dr. ${appointment.doctorName || 'Specialist'}.`;
      whatsappService.sendWhatsAppMessage(appointment.patientContact.value, confirmMsg);
    }

    req.flash('success', 'Appointment confirmed successfully!');
    res.redirect(`/appointments/${appointment._id}`);
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};

// Direct GET link cancellation from WhatsApp alert
exports.getCancel = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      req.flash('error', 'Appointment not found.');
      return res.redirect('/');
    }
    appointment.status = 'Cancelled';
    await appointment.save();

    // Free slot
    const Doctor = require('../models/Doctor');
    await Doctor.findOneAndUpdate(
      { 
        _id: appointment.doctorId,
        availability: { $elemMatch: { date: new Date(appointment.appointmentSlot.date), time: appointment.appointmentSlot.time } }
      },
      { $set: { "availability.$.isBooked": false } }
    );

    if (appointment.patientContact && appointment.patientContact.value) {
      const whatsappService = require('../services/whatsappService');
      const cancelMsg = `⚠️ Sparsh Alert: Your appointment request has been declined.`;
      whatsappService.sendWhatsAppMessage(appointment.patientContact.value, cancelMsg);
    }

    req.flash('success', 'Appointment declined successfully.');
    res.redirect(`/appointments/${appointment._id}`);
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
};

// Register anonymous patient to full account
exports.postRegisterPatient = async (req, res) => {
  const { name, email, contact, age } = req.body;

  try {
    const appointment = await Appointment.findById(req.params.id).populate('patientId');
    if (!appointment) {
      req.flash('error', 'Appointment not found.');
      return res.redirect('/');
    }

    // Ensure only the assigned doctor can do this
    if (req.user.role !== 'doctor' || appointment.doctorId.toString() !== req.user._id.toString()) {
      req.flash('error', 'Unauthorized action.');
      return res.redirect('/');
    }

    const patient = appointment.patientId;
    if (!patient || !patient.isAnonymous) {
      req.flash('error', 'Patient is already registered or invalid.');
      return res.redirect(`/appointments/${req.params.id}`);
    }

    // Check if email or contact is already used by another user
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { contact }] });
    if (existingUser && existingUser._id.toString() !== patient._id.toString()) {
      req.flash('error', 'Email or contact number is already associated with an account.');
      return res.redirect(`/appointments/${req.params.id}`);
    }

    // Update patient user record
    patient.name = name.trim();
    patient.email = email.toLowerCase().trim();
    patient.contact = contact.trim();
    patient.age = Number(age);
    patient.isAnonymous = false;
    patient.password = 'Sparsh@123'; // The pre-save hook will hash this

    await patient.save();

    // Update appointment record just in case
    appointment.patientName = patient.name;
    appointment.patientContact = { type: 'phone', value: patient.contact };
    await appointment.save();

    req.flash('success', `Patient ${patient.name} has been successfully registered. Tell them their default password is Sparsh@123`);
    res.redirect(`/appointments/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to register patient account.');
    res.redirect(`/appointments/${req.params.id}`);
  }
};

// ─── POST Rate Appointment & Practitioner ──────────────────────────────────
exports.postRateAppointment = async (req, res) => {
  const { score, reviewText } = req.body;
  const ratingScore = Number(score) || 5;

  try {
    const Doctor = require('../models/Doctor');
    const appointment = await Appointment.findById(req.params.id).populate('patientId');
    if (!appointment) {
      req.flash('error', 'Appointment record not found.');
      return res.redirect('/');
    }

    if (req.user.role !== 'patient' || appointment.patientId._id.toString() !== req.user._id.toString()) {
      req.flash('error', 'Only the assigned patient can submit feedback for this consultation.');
      return res.redirect(`/appointments/${req.params.id}`);
    }

    const doctor = await Doctor.findById(appointment.doctorId);
    if (doctor) {
      const patientName = appointment.isAnonymous ? 'Anonymous Patient' : req.user.name;
      doctor.ratings.push({
        patientName,
        score: ratingScore,
        reviewText: reviewText ? reviewText.trim() : 'Great clinical guidance and consultation experience.',
        createdAt: new Date()
      });
      await doctor.save();
    }

    req.flash('success', 'Thank you! Your feedback and star rating have been recorded.');
    res.redirect(`/appointments/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to record rating.');
    res.redirect(`/appointments/${req.params.id}`);
  }
};


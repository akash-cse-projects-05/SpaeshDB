const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const whatsappService = require('./whatsappService');

const CHECK_INTERVAL = 60 * 1000; // Check every 60 seconds

const startReminderService = () => {
  console.log("⏰ WhatsApp Reminder Service Started (Polling every 60s)");

  setInterval(async () => {
    try {
      // Find all confirmed appointments where a reminder hasn't been sent yet
      // In a real app, we'd also check if the appointment is < 24 hours away.
      // For this demo, we'll just send reminders for ANY confirmed/completed appointment that hasn't gotten one.
      const upcomingAppointments = await Appointment.find({
        status: { $in: ['Confirmed', 'Completed'] },
        reminderSent: false
      }).populate('doctorId');

      for (const apt of upcomingAppointments) {
        console.log(`Sending reminder for appointment ${apt._id}`);
        
        const dateStr = apt.appointmentSlot.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = apt.appointmentSlot.time;
        
        // Format string so whatsappService can parse it
        const messageString = `Reminder! Slot: ${dateStr} at ${timeStr}`;

        // 1. Send to Patient (if they provided a phone number)
        if (apt.patientContact && apt.patientContact.method === 'Phone' && apt.patientContact.value) {
          try {
            await whatsappService.sendWhatsAppMessage(apt.patientContact.value, messageString);
            console.log(`✅ Patient reminder sent to ${apt.patientContact.value}`);
          } catch (err) {
            console.error(`Failed to send patient reminder:`, err);
          }
        }

        // 2. Send to Doctor (if doctor has a phone number)
        if (apt.doctorId && apt.doctorId.phoneNumber) {
          try {
            await whatsappService.sendWhatsAppMessage(apt.doctorId.phoneNumber, messageString);
            console.log(`✅ Doctor reminder sent to ${apt.doctorId.phoneNumber}`);
          } catch (err) {
            console.error(`Failed to send doctor reminder:`, err);
          }
        }

        // Mark as sent
        apt.reminderSent = true;
        await apt.save();
      }
    } catch (error) {
      console.error("Error in reminder service cron loop:", error);
    }
  }, CHECK_INTERVAL);
};

module.exports = {
  startReminderService
};

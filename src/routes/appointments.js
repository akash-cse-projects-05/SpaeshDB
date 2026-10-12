const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { ensureAuthenticated } = require('../middleware/auth');

// Protect all routes
router.use(ensureAuthenticated);

// Get details
router.get('/:id', appointmentController.getAppointmentDetails);

// One-click WhatsApp Accept / Decline actions
router.get('/:id/confirm', appointmentController.getConfirm);
router.get('/:id/cancel', appointmentController.getCancel);

// Manage status and messages
router.post('/:id/message', appointmentController.postAddMessage);
router.post('/:id/status', appointmentController.postUpdateStatus);
router.post('/:id/cancel', appointmentController.postCancel);



// Prescription (Doctor only restriction checked inside controller)
router.post('/:id/prescription', appointmentController.postUpdatePrescription);

// Register Anonymous Patient (Doctor only)
router.post('/:id/register-patient', appointmentController.postRegisterPatient);

// Rate Appointment & Practitioner
router.post('/:id/rate', appointmentController.postRateAppointment);

module.exports = router;

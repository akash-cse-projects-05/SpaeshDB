const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { ensureAuthenticated, ensurePatient } = require('../middleware/auth');

// Apply middleware to all routes in this router
router.use(ensureAuthenticated, ensurePatient);

router.get('/dashboard', patientController.getDashboard);
router.get('/book', patientController.getBook);
router.post('/book', patientController.postBook);
router.get('/booking-confirmed/:id', patientController.getBookingConfirmation);

// PrEP Tracker routes
router.get('/prep-tracker', patientController.getPrepTracker);
router.post('/prep-tracker/activate', patientController.postActivatePrepTracker);
router.post('/prep-tracker/log', patientController.postLogPrepDose);

// PEP Exposure setter route
router.post('/set-pep-exposure', patientController.postSetPepExposure);

// PEP Emergency Auto-Match route
router.post('/book-auto-pep', patientController.postAutoMatchPep);

module.exports = router;

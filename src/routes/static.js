const express = require('express');
const router = express.Router();
const staticController = require('../controllers/staticController');

// Home page
router.get('/', staticController.getHome);

// Info & FAQ pages
router.get('/learn', staticController.getLearn);
router.get('/faq', staticController.getFaq);

// Blog pages
router.get('/blog', staticController.getBlog);
router.get('/blog/:slug', staticController.getArticleDetails);

// Public Booking pages
router.get('/book', staticController.getBook);
router.post('/book', staticController.postBook);

// WhatsApp Bot Simulator (Local Dev)
router.get('/bot-simulator', staticController.getBotSimulator);

// Mock Video Consultation Room
router.get('/consultation/room', (req, res) => {
  res.render('room', {
    title: 'Sparsh - Live Consultation',
    currentUser: req.session.user || null
  });
});

// Prescription Verification Portal
router.get('/prescription/verify/:id', staticController.getVerifyPrescription);
router.post('/prescription/verify/:id', staticController.postVerifyPrescription);

module.exports = router;

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// Protect all admin routes
router.use(ensureAuthenticated, ensureAdmin);

router.get('/dashboard', adminController.getDashboard);
router.get('/doctor/:id/details', adminController.getDoctorDetails);
router.get('/doctor/:id/analytics', adminController.getDoctorAnalytics);
router.post('/doctor/toggle', adminController.postToggleDoctorApproval);
router.post('/doctor/create', adminController.postCreateDoctor);
router.post('/doctor/delete', adminController.postDeleteDoctor);
router.post('/blog/create', adminController.postCreateArticle);

module.exports = router;

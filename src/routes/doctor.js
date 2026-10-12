const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { ensureAuthenticated, ensureDoctor } = require('../middleware/auth');

// Apply doctor protection to all routes
router.use(ensureAuthenticated, ensureDoctor);

router.get('/dashboard',             doctorController.getDashboard);
router.get('/profile',               doctorController.getProfile);
router.post('/slot/add',             doctorController.postAddSlot);
router.post('/slots/bulk',           doctorController.postBulkSlots);
router.post('/slot/delete',          doctorController.postDeleteSlot);
router.post('/slots/clear-expired',  doctorController.postClearExpiredSlots);
router.post('/slots/clear-day',      doctorController.postClearDaySlots);
router.post('/profile/update',       doctorController.postUpdateProfile);
router.post('/appointment/action',   doctorController.postAppointmentAction);
router.get('/payouts',               doctorController.getPayouts);

module.exports = router;

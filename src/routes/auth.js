const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Patient Registration
router.get('/signup/patient', authController.getSignupPatient);
router.post('/signup/patient', authController.postSignupPatient);

const multer = require('multer');
const path = require('path');

const fs = require('fs');

// Configure multer for resume uploads
const uploadDir = path.join(__dirname, '../public/uploads/resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB maximum file size limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.doc' || ext === '.docx') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  }
});

// Doctor Registration
router.get('/signup/doctor', authController.getSignupDoctor);
router.post('/signup/doctor', (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      req.flash('error', err.message || 'File upload failed. Please upload a PDF or DOCX resume.');
      return res.redirect('/auth/signup/doctor');
    }
    next();
  });
}, authController.postSignupDoctor);

// Combined Login Page
router.get('/login', authController.getLogin);

// Login Submissions (Separate routes depending on client type)
router.post('/login/patient', authController.postLoginPatient);
router.post('/login/doctor', authController.postLoginDoctor);

// Logout
router.get('/logout', authController.logout);

module.exports = router;

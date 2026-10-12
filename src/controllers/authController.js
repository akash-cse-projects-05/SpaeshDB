const User = require('../models/User');
const Doctor = require('../models/Doctor');
const passport = require('passport');

exports.getSignupPatient = (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect(req.user.role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard');
  }
  res.render('auth/signup-patient', { title: 'Patient Registration - Sparsh' });
};

exports.postSignupPatient = async (req, res) => {
  const { name, email, password, confirmPassword, age, contact, isAnonymous } = req.body;
  
  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/auth/signup/patient');
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    const existingDoc = await Doctor.findOne({ email: email.toLowerCase() });
    if (existingUser || existingDoc) {
      req.flash('error', 'Email is already registered.');
      return res.redirect('/auth/signup/patient');
    }

    const newUser = new User({
      name: isAnonymous ? 'Anonymous Patient' : name,
      email: email.toLowerCase(),
      password,
      age: parseInt(age) || 0,
      contact: contact || 'N/A',
      isAnonymous: !!isAnonymous,
      role: 'patient'
    });

    await newUser.save();
    req.flash('success', 'Registration successful! Please login.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'An error occurred during registration.');
    res.redirect('/auth/signup/patient');
  }
};

exports.getSignupDoctor = (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect(req.user.role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard');
  }
  res.render('auth/signup-doctor', { title: 'Doctor Registration - Sparsh' });
};

exports.postSignupDoctor = async (req, res) => {
  const { name, email, password, confirmPassword, specialization, qualification, phoneNumber, consultationFee, bio, gender } = req.body;

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/auth/signup/doctor');
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    const existingDoc = await Doctor.findOne({ email: email.toLowerCase() });
    if (existingUser || existingDoc) {
      req.flash('error', 'This email is already registered. Try logging in or use a new email address.');
      return res.redirect('/auth/signup/doctor');
    }

    const resumePath = req.file ? '/uploads/resumes/' + req.file.filename : '';

    const newDoctor = new Doctor({
      name,
      email: email.toLowerCase(),
      password,
      specialization,
      qualification,
      phoneNumber,
      consultationFee: parseFloat(consultationFee) || 500,
      bio,
      gender: gender || 'Male',
      resume: resumePath,
      availability: [],
      isApproved: false // Newly signed up doctors require admin review/verification before logging in
    });

    await newDoctor.save();
    req.flash('success', 'Practitioner registration submitted. Please wait for an administrator to verify your credentials.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Doctor signup error:', err);
    req.flash('error', err.message || 'An error occurred during registration.');
    res.redirect('/auth/signup/doctor');
  }
};

exports.getLogin = (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect(req.user.role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard');
  }
  res.render('auth/login', { title: 'Portal Login - Sparsh' });
};

exports.postLoginPatient = (req, res, next) => {
  passport.authenticate('patient-local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', info && info.message ? info.message : 'Invalid email or password.');
      return res.redirect('/auth/login');
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      req.flash('success', 'Welcome back to Sparsh!');
      if (user.role === 'admin') {
        return res.redirect('/admin/dashboard');
      }
      return res.redirect('/patient/dashboard');
    });
  })(req, res, next);
};

exports.postLoginDoctor = (req, res, next) => {
  passport.authenticate('doctor-local', {
    successRedirect: '/doctor/dashboard',
    failureRedirect: '/auth/login',
    failureFlash: true,
    successFlash: 'Access granted. Welcome back, Doctor!'
  })(req, res, next);
};

exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash('success', 'You have successfully logged out.');
    res.redirect('/');
  });
};

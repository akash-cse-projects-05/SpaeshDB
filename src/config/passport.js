const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const Doctor = require('../models/Doctor');

module.exports = function(passport) {
  // Patient strategy
  passport.use('patient-local', new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        return done(null, { id: user._id, role: user.role });
      } catch (err) {
        return done(err);
      }
    }
  ));

  // Doctor strategy
  passport.use('doctor-local', new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const doctor = await Doctor.findOne({ email: email.toLowerCase() });
        if (!doctor) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        const isMatch = await doctor.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        if (!doctor.isApproved) {
          return done(null, false, { message: 'Your professional credentials are under verification.' });
        }
        return done(null, { id: doctor._id, role: 'doctor' });
      } catch (err) {
        return done(err);
      }
    }
  ));

  // Serialize session info
  passport.serializeUser((userSessionData, done) => {
    done(null, userSessionData);
  });

  // Deserialize user from session
  passport.deserializeUser(async (userSessionData, done) => {
    try {
      if (userSessionData.role === 'doctor') {
        const doctor = await Doctor.findById(userSessionData.id).select('-password');
        if (doctor) {
          return done(null, doctor);
        }
      } else {
        const user = await User.findById(userSessionData.id).select('-password');
        if (user) {
          return done(null, user);
        }
      }
      return done(new Error('User not found'));
    } catch (err) {
      done(err);
    }
  });
};

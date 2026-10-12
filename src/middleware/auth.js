exports.ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please log in to access this page.');
  res.redirect('/auth/login');
};

exports.ensurePatient = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'patient') {
    return next();
  }
  req.flash('error', 'Access denied. Patient portal only.');
  res.redirect('/');
};

exports.ensureDoctor = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'doctor') {
    return next();
  }
  req.flash('error', 'Access denied. Professional portal only.');
  res.redirect('/');
};

exports.ensureAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Administration portal only.');
  res.redirect('/');
};

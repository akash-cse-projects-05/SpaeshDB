require('dotenv').config(); // ⚠️ MUST be first — loads MONGODB_URI before connectDB() is called

const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const passport = require('passport');
const flash = require('express-flash');
const csurf = require('csurf');
const connectDB = require('./config/db');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false })); // Disable CSP to prevent blocking CDNs/inline scripts

// Trust proxies (required for localtunnel and express-rate-limit)
app.set('trust proxy', 1);

// Rate limiting (Global)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Specific rate limiters for auth routes can be added here or in the router directly
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 login/signup requests per hour
  message: 'Too many authentication attempts, please try again after an hour'
});
app.use('/auth', authLimiter);


// Environment variables already loaded at the top of this file

// Passport configuration
require('./config/passport')(passport);

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(process.cwd(), 'src', 'views'),
  path.join(process.cwd(), 'views')
]);


// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static Folder
app.use(express.static(path.join(__dirname, 'public')));

// Express Session Middleware
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'sparsh_secret_key_default',
  resave: false,
  saveUninitialized: true,
  proxy: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto'
  }
};

if (process.env.NODE_ENV !== 'test') {
  const store = MongoStore.create({
    clientPromise: connectDB().then(conn => conn.connection.getClient()).catch(err => {
      console.error('⚠️ MongoStore failed to obtain MongoDB client:', err.message);
      return null;
    }),
    collectionName: 'sessions'
  });
  store.on('error', (err) => {
    console.error('⚠️ MongoStore runtime error:', err.message);
  });
  sessionOptions.store = store;
}


app.use(session(sessionOptions));

// Flash middleware
app.use(flash());

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Webhook Router (Mounted before CSRF to bypass CSRF token checks)
const webhookRoutes = require('./routes/webhook');
app.use('/api/webhooks', webhookRoutes);

// Enable CSRF protection
const csrfProtection = csurf({ cookie: false });
app.use(csrfProtection);

// Global variables for views
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Route imports
const staticRoutes = require('./routes/static');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patient');
const doctorRoutes = require('./routes/doctor');
const adminRoutes = require('./routes/admin');
const appointmentRoutes = require('./routes/appointments');

// Use Routes
app.use('/', staticRoutes);
app.use('/auth', authRoutes);
app.use('/patient', patientRoutes);
app.use('/doctor', doctorRoutes);
app.use('/admin', adminRoutes);
app.use('/appointments', appointmentRoutes);

// CSRF Token Error Handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    req.flash('error', 'Session expired or invalid submission. Please refresh the page and try again.');
    return res.redirect(req.headers.referer || '/auth/login');
  }
  next(err);
});

// 404 Error handler
app.use((req, res, next) => {
  res.status(404).render('static/404', { title: '404 - Not Found' });
});

// General Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  try {
    res.status(500).render('static/500', { title: '500 - Server Error', error: err.message, currentUser: req.user || null });
  } catch (renderErr) {
    res.status(500).send(`<!DOCTYPE html><html><body><h1>500 - Server Error</h1><p>${err.message}</p></body></html>`);
  }
});


module.exports = app;

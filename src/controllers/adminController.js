const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Article = require('../models/Article');
const whatsappService = require('../services/whatsappService');

// Render admin panel dashboard
exports.getDashboard = async (req, res) => {
  try {
    const doctors = await Doctor.find().sort({ createdAt: -1 });
    const appointments = await Appointment.find()
      .populate('patientId', 'name isAnonymous email age contact')
      .populate('doctorId', 'name specialization qualification email')
      .sort({ createdAt: -1 });
    const articlesCount = await Article.countDocuments();

    const pendingCount = doctors.filter(d => !d.isApproved).length;

    // Calculate Financial Revenue Metrics
    let grossRevenue = 0;
    appointments.forEach(app => {
      if (app.paymentDetails && app.paymentDetails.status === 'Paid') {
        grossRevenue += (app.paymentDetails.amount || 0);
      }
    });

    const platformFeePercentage = 0.20; // 20% platform cut
    const platformCommission = Math.round(grossRevenue * platformFeePercentage);
    const doctorPayoutLiability = grossRevenue - platformCommission;

    const botDiagnostics = whatsappService.getBotStatus ? whatsappService.getBotStatus() : { provider: 'Simulated', isConnected: true, statusMessage: 'Active' };

    // Calculate doctor histories, earnings, and build nested clinical logs
    const doctorsWithHistory = doctors.map(doc => {
      const docApps = appointments.filter(app => app.doctorId && app.doctorId._id.toString() === doc._id.toString());
      
      let grossEarnings = 0;
      docApps.forEach(app => {
        if (app.paymentDetails && app.paymentDetails.status === 'Paid') {
          grossEarnings += (app.paymentDetails.amount || 0);
        }
      });

      // Fallback: estimate earnings if completed appointments exist without explicit payment payload
      if (grossEarnings === 0) {
        const completedCount = docApps.filter(app => app.status === 'Completed').length;
        if (completedCount > 0) {
          const fee = doc.feePerConsultation || 500;
          grossEarnings = completedCount * fee;
        }
      }

      const platformCut = Math.round(grossEarnings * 0.20);
      const netPayout = grossEarnings - platformCut;

      return {
        ...doc.toObject(),
        totalAppointments: docApps.length,
        completedAppointments: docApps.filter(app => app.status === 'Completed').length,
        pendingAppointments: docApps.filter(app => app.status === 'Pending').length,
        cancelledAppointments: docApps.filter(app => app.status === 'Cancelled').length,
        confirmedAppointments: docApps.filter(app => app.status === 'Confirmed').length,
        grossEarnings,
        platformCut,
        netPayout,
        clinicalLogs: docApps.map(app => {
          let displayPatient = 'Unknown Patient';
          if (app.patientId) {
            displayPatient = app.patientId.isAnonymous ? `🔒 Patient (Anon-${app.patientId._id.toString().slice(-4).toUpperCase()})` : app.patientId.name;
          } else if (app.patientName) {
            displayPatient = app.isAnonymous ? `🔒 Patient (Anon-${app._id.toString().slice(-4).toUpperCase()})` : app.patientName;
          }
          return {
            _id: app._id,
            patientName: displayPatient,
            patientEmail: app.patientId?.email || app.patientContact?.value || 'N/A',
            consultationType: app.consultationType,
            consultationMode: app.consultationMode,
            date: app.appointmentSlot ? app.appointmentSlot.date : app.date,
            time: app.appointmentSlot ? app.appointmentSlot.time : app.time,
            status: app.status,
            prescription: app.prescription || null
          };
        })
      };
    });

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - Sparsh',
      doctors: doctorsWithHistory,
      appointments,
      articlesCount,
      pendingCount,
      financials: {
        grossRevenue,
        platformCommission,
        doctorPayoutLiability
      },
      botDiagnostics
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load administration data.');
    res.redirect('/');
  }
};

// Toggle doctor approval status
exports.postToggleDoctorApproval = async (req, res) => {
  const { doctorId, action } = req.body;
  try {
    const isApproved = action === 'approve';
    await Doctor.findByIdAndUpdate(doctorId, { isApproved });
    req.flash('success', `Doctor account ${isApproved ? 'approved' : 'disapproved'} successfully.`);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Action failed. Doctor not updated.');
    res.redirect('/admin/dashboard');
  }
};

// Create a new article
exports.postCreateArticle = async (req, res) => {
  const { title, summary, content, category, author } = req.body;
  
  if (!title || !summary || !content || !category || !author) {
    req.flash('error', 'All blog fields are required.');
    return res.redirect('/admin/dashboard');
  }

  // Create slug from title
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  try {
    const existing = await Article.findOne({ slug });
    if (existing) {
      req.flash('error', 'An article with a similar title already exists.');
      return res.redirect('/admin/dashboard');
    }

    const newArticle = new Article({
      title,
      slug,
      summary,
      content,
      category,
      author
    });

    await newArticle.save();
    req.flash('success', 'Educational article published successfully!');
    res.redirect('/blog/' + slug);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to publish blog article.');
    res.redirect('/admin/dashboard');
  }
};

// Directly Register Doctor profile
exports.postCreateDoctor = async (req, res) => {
  const { name, email, password, confirmPassword, specialization, qualification, gender } = req.body;

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/admin/dashboard');
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    const existingDoc = await Doctor.findOne({ email: email.toLowerCase() });
    if (existingUser || existingDoc) {
      req.flash('error', 'Email is already registered on Sparsh.');
      return res.redirect('/admin/dashboard');
    }

    const newDoctor = new Doctor({
      name,
      email: email.toLowerCase(),
      password,
      specialization,
      qualification,
      gender: gender || 'Male',
      availability: [],
      isApproved: true
    });

    await newDoctor.save();
    req.flash('success', `Practitioner profile for ${name} registered successfully.`);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to create doctor profile.');
    res.redirect('/admin/dashboard');
  }
};

// Remove Doctor profile
exports.postDeleteDoctor = async (req, res) => {
  const { doctorId } = req.body;

  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      req.flash('error', 'Doctor profile not found.');
      return res.redirect('/admin/dashboard');
    }

    // Cancel all appointments assigned to this doctor
    await Appointment.updateMany(
      { doctorId: doctorId, status: { $in: ['Pending', 'Confirmed'] } },
      { status: 'Cancelled' }
    );

    // Delete doctor document
    await Doctor.findByIdAndDelete(doctorId);

    req.flash('success', `Practitioner profile for ${doctor.name} removed successfully. Active slots cancelled.`);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete doctor profile.');
    res.redirect('/admin/dashboard');
  }
};

exports.getDoctorDetails = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      req.flash('error', 'Doctor profile not found.');
      return res.redirect('/admin/dashboard');
    }

    // Find all appointments associated with this doctor
    const appointments = await Appointment.find({ doctorId: doctor._id })
      .populate('patientId', 'name isAnonymous email age contact')
      .sort({ createdAt: -1 });

    // History and calculations
    const stats = {
      total: appointments.length,
      completed: appointments.filter(a => a.status === 'Completed').length,
      pending: appointments.filter(a => a.status === 'Pending').length,
      cancelled: appointments.filter(a => a.status === 'Cancelled').length,
      confirmed: appointments.filter(a => a.status === 'Confirmed').length
    };

    // Calculate average rating
    let averageRating = 0;
    if (doctor.ratings && doctor.ratings.length > 0) {
      const sum = doctor.ratings.reduce((acc, r) => acc + r.score, 0);
      averageRating = (sum / doctor.ratings.length).toFixed(1);
    }

    res.render('admin/doctor_details', {
      title: `${doctor.name} Details - Sparsh`,
      doctor,
      appointments,
      stats,
      averageRating
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load practitioner details.');
    res.redirect('/admin/dashboard');
  }
};

exports.getDoctorAnalytics = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      req.flash('error', 'Doctor profile not found.');
      return res.redirect('/admin/dashboard');
    }

    // Find all appointments associated with this doctor
    const appointments = await Appointment.find({ doctorId: doctor._id })
      .populate('patientId', 'name isAnonymous email age contact')
      .sort({ createdAt: -1 });

    // Performance and calculations
    const total = appointments.length;
    const completed = appointments.filter(a => a.status === 'Completed').length;
    const pending = appointments.filter(a => a.status === 'Pending').length;
    const cancelled = appointments.filter(a => a.status === 'Cancelled').length;
    const confirmed = appointments.filter(a => a.status === 'Confirmed').length;

    // Calculate revenue
    const revenue = completed * (doctor.consultationFee || 500);

    // Calculate average rating
    let averageRating = 0;
    let ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (doctor.ratings && doctor.ratings.length > 0) {
      const sum = doctor.ratings.reduce((acc, r) => {
        const score = Math.round(r.score);
        if (ratingBreakdown[score] !== undefined) ratingBreakdown[score]++;
        return acc + r.score;
      }, 
      0);
      averageRating = (sum / doctor.ratings.length).toFixed(1);
    }

    res.render('admin/doctor_analytics', {
      title: `${doctor.name} Analytics - Sparsh`,
      doctor,
      appointments,
      stats: {
        total,
        completed,
        pending,
        cancelled,
        confirmed,
        revenue,
        ratingBreakdown
      },
      averageRating
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load practitioner analytics.');
    res.redirect('/admin/dashboard');
  }
};

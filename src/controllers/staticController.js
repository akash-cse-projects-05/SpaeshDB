const Article = require('../models/Article');
const User = require('../models/User');
const emailService = require('../services/emailService');
const whatsappService = require('../services/whatsappService');

// Helper to seed initial articles if none exist
const seedArticlesIfEmpty = async () => {
  try {
    const count = await Article.countDocuments();
    if (count === 0) {
      await Article.create([
        {
          title: 'Understanding PEP: The 72-Hour Window After Potential Exposure',
          slug: 'understanding-pep-72-hour-window',
          category: 'PEP',
          author: 'Dr. Sameer Joshi, Infectious Diseases Specialist',
          summary: 'PEP (Post-Exposure Prophylaxis) can prevent HIV infection if taken within 72 hours of potential exposure. Learn how it works, when to take it, and what to expect.',
          content: `<h2>What is PEP?</h2><p>Post-Exposure Prophylaxis (PEP) is a combination of antiretroviral medicines taken after a single high-risk event to prevent HIV transmission. It must be started within 72 hours of potential exposure, though sooner is always better. Every hour counts.</p>
          <h2>When is PEP recommended?</h2><p>PEP is recommended for emergency situations, such as:</p>
          <ul>
            <li>Unprotected sexual contact with a partner of unknown or positive HIV status.</li>
            <li>Condom breakage during intercourse.</li>
            <li>Sharing needles or syringes.</li>
            <li>Occupational exposure (e.g., healthcare workers with needlestick injuries).</li>
          </ul>
          <h2>How do you take PEP?</h2><p>PEP is a daily regimen that lasts for 28 days. It is extremely important to complete the entire 28-day course to ensure full efficacy. Stopping early increases the risk of the virus taking hold.</p>`
        },
        {
          title: 'PrEP: Daily Prevention for Long-Term Peace of Mind',
          slug: 'prep-daily-prevention-hiv',
          category: 'PrEP',
          author: 'Dr. Ananya Roy, HIV Medicine Consultant',
          summary: 'Pre-Exposure Prophylaxis (PrEP) is a highly effective daily pill that protects individuals at higher risk from contracting HIV. Read on to see if PrEP is right for you.',
          content: `<h2>What is PrEP?</h2><p>Pre-Exposure Prophylaxis (PrEP) is a highly effective medicine that reduces the risk of getting HIV from sex by about 99% when taken consistently. It works by stopping the virus from establishing a permanent infection in the body.</p>
          <h2>Who should consider PrEP?</h2><p>PrEP is highly recommended for individuals who are HIV-negative and:</p>
          <ul>
            <li>Have a sexual partner who has HIV (especially if the partner is not virally suppressed).</li>
            <li>Do not consistently use condoms during sex.</li>
            <li>Have been diagnosed with an STI in the last 6 months.</li>
            <li>Share needles or work in settings with high potential exposure.</li>
          </ul>
          <h2>Adherence is Key</h2><p>PrEP is highly effective, but its protection declines significantly if it is not taken daily as prescribed. Setting a routine is key to ensuring you are protected at all times.</p>`
        },
        {
          title: 'Navigating the Emotional Landscape: HIV Counselling & Guidance',
          slug: 'navigating-emotional-hiv-counselling',
          category: 'General Health',
          author: 'Meera Sen, Chief Counsel',
          summary: 'An HIV diagnosis or potential exposure can be emotionally overwhelming. Professional counseling provides confidentiality, answers, and support to guide you.',
          content: `<h2>The Power of Confidential Counselling</h2><p>Living with the fear of HIV exposure or managing a diagnosis requires more than just clinical treatment. Compassionate mental health counseling provides a safe environment where you can speak anonymously without fear of judgment or social stigma.</p>
          <h2>What happens in a Counselling Session?</h2><p>Counsellors work with you to understand your specific situation. They help you build a personalized risk-reduction plan, explain medical options like PEP/PrEP, and connect you with ongoing medical professionals who prioritize your confidentiality.</p>`
        }
      ]);
      console.log('Default blog articles seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding articles:', err);
  }
};

const seedAdminIfEmpty = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@sparsh.org' });
    if (!adminExists) {
      const adminUser = new User({
        name: 'System Administrator',
        email: 'admin@sparsh.org',
        password: process.env.ADMIN_PASSWORD || 'adminpassword123',
        age: 35,
        contact: '+91 90000 00000',
        isAnonymous: false,
        role: 'admin'
      });
      await adminUser.save();
      console.log('Default administrator account (admin@sparsh.org) seeded successfully.');
    }

    const oldAdmin = await User.findOne({ email: 'admin@sparsh.com' });
    if (oldAdmin) {
      oldAdmin.password = 'adminpassword123';
      await oldAdmin.save();
      console.log('Updated admin@sparsh.com password to adminpassword123.');
    }
  } catch (err) {
    console.error('Error seeding admin user:', err);
  }
};

exports.getHome = async (req, res) => {
  await seedArticlesIfEmpty();
  await seedAdminIfEmpty();
  try {
    const featuredArticles = await Article.find().sort({ createdAt: -1 }).limit(3);
    res.render('index', { title: 'Sparsh – Touch of Care', featuredArticles });
  } catch (err) {
    console.error(err);
    res.render('index', { title: 'Sparsh – Touch of Care', featuredArticles: [] });
  }
};

exports.getLearn = (req, res) => {
  res.render('learn', { title: 'Learn PEP & PrEP - Sparsh' });
};

exports.getFaq = (req, res) => {
  res.render('faq', { title: 'FAQs - Sparsh' });
};

exports.getBotSimulator = (req, res) => {
  res.render('static/simulator', { title: 'WhatsApp Bot Simulator - Sparsh' });
};

exports.getBlog = async (req, res) => {
  await seedArticlesIfEmpty();
  try {
    const articles = await Article.find().sort({ createdAt: -1 });
    res.render('blog/index', { title: 'Educational Blog - Sparsh', articles });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to fetch blog articles.');
    res.redirect('/');
  }
};

exports.getArticleDetails = async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) {
      return res.status(404).render('static/404', { title: 'Article Not Found' });
    }
    res.render('blog/show', { title: `${article.title} - Sparsh`, article });
  } catch (err) {
    console.error(err);
    res.redirect('/blog');
  }
};

const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const bcrypt = require('bcryptjs');

exports.getBook = async (req, res) => {
  try {
    const doctors = await Doctor.find({ isApproved: true }).select('name specialization qualification availability consultationFee gender');
    res.render('static/book', {
      title: 'Book a Consultation - Sparsh',
      doctors
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to fetch clinical consultants.');
    res.redirect('/');
  }
};

exports.postBook = async (req, res) => {
  const { doctorId, consultationType, consultationMode, date, time, contactMethod, contactValue, amount } = req.body;

  try {
    const doctor = await Doctor.findOneAndUpdate(
      { 
        _id: doctorId, 
        isApproved: true,
        availability: { $elemMatch: { date: new Date(date), time: time, isBooked: false } }
      },
      {
        $set: { "availability.$.isBooked": true }
      },
      { new: true }
    );

    if (!doctor) {
      req.flash('error', 'The selected doctor or slot is not available. Please try another.');
      return res.redirect('/book');
    }

    let patientId;

    if (req.user && req.user.role === 'patient') {
      patientId = req.user._id;
    } else {
      let anonymousUser = await User.findOne({ email: contactValue, isAnonymous: true });
      if (!anonymousUser) {
        anonymousUser = new User({
          name: 'Anonymous Patient',
          email: contactValue,
          password: Math.random().toString(36).slice(-8) + 'A1!',
          age: 0,
          contact: contactValue,
          isAnonymous: true,
          role: 'patient'
        });
        await anonymousUser.save();
      }
      patientId = anonymousUser._id;
    }

    const appointment = new Appointment({
      patientId: patientId,
      doctorId: doctorId,
      consultationType,
      consultationMode: consultationMode || 'Video Consultation',
      appointmentSlot: { date, time },
      patientHistory: `Primary service requested: ${consultationType}. Anonymous booking.`,
      patientContact: {
        method: contactMethod || 'Email',
        value: contactValue || 'Not provided'
      },
      paymentDetails: {
        amount: parseFloat(amount) || 400,
        transactionId: `TXN-${Date.now()}`,
        status: 'Paid'
      },
      status: 'Pending'
    });

    await appointment.save();

    // Send actual notifications to doctor
    const patientName = appointment.isAnonymous ? 'Anonymous Patient' : (req.user ? req.user.name : 'Anonymous Guest');
    const acceptLink = `${process.env.APP_URL || 'http://localhost:3001'}/appointments/${appointment._id}/confirm`;
    const declineLink = `${process.env.APP_URL || 'http://localhost:3001'}/appointments/${appointment._id}/cancel`;

    const whatsappMsg = `📅 New Sparsh Appointment Alert!\n\nHello Dr. ${doctor.name}, a patient (${patientName}) has requested a ${consultationType} consultation on Sparsh for ${date} at ${time}.\n\nReply directly to this WhatsApp chat:\n1️⃣ Reply "1" or "ACCEPT" to Approve\n2️⃣ Reply "2" or "DECLINE" to Reject`;

    // Send email to doctor
    emailService.sendAppointmentNotification(
      doctor.email,
      doctor.name,
      patientName,
      date,
      time,
      consultationType,
      `Requested communication method: ${contactMethod || 'Email'} (${contactValue || 'Not provided'})`
    );

    // Send WhatsApp message to doctor
    const docPhone = doctor.phoneNumber || process.env.TWILIO_WHATSAPP_NUMBER;
    if (docPhone) {
      whatsappService.sendWhatsAppMessage(docPhone, whatsappMsg);
    }

    req.flash('success', `Booking Confirmed! Your appointment with ${doctor.name} on ${date} at ${time} is confirmed.`);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error', 'An error occurred during booking. Please try again.');
    res.redirect('/book');
  }
};

// Prescription Verification Controllers
exports.getVerifyPrescription = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment || !appointment.prescription || !appointment.prescription.medication) {
      return res.status(404).render('static/404', { title: 'Prescription Not Found' });
    }
    res.render('static/verifyPrescription', {
      title: 'Verify Prescription - Sparsh',
      appointmentId: appointment._id,
      verified: false,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('static/500', { title: 'Verification Error', error: 'Internal Server Error' });
  }
};

exports.postVerifyPrescription = async (req, res) => {
  const { pin } = req.body;
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name isAnonymous')
      .populate('doctorId', 'name qualification');
      
    if (!appointment || !appointment.prescription || !appointment.prescription.medication) {
      return res.status(404).render('static/404', { title: 'Prescription Not Found' });
    }
    
    const pinMatch = appointment.prescription.verificationPin === pin;
    if (!pinMatch) {
      return res.render('static/verifyPrescription', {
        title: 'Verify Prescription - Sparsh',
        appointmentId: appointment._id,
        verified: false,
        error: 'Invalid 4-Digit Access PIN. Access Denied.'
      });
    }
    
    res.render('static/verifyPrescription', {
      title: 'Prescription Verified - Sparsh',
      appointmentId: appointment._id,
      verified: true,
      appointment,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('static/500', { title: 'Verification Error', error: 'Internal Server Error' });
  }
};

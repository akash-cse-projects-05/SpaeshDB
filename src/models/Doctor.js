const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Individual date+time slot (not weekly schedule)
const SlotSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String, // "HH:MM" e.g. "10:00"
    required: true
  },
  isBooked: {
    type: Boolean,
    default: false
  }
});

const DoctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  specialization: {
    type: String,
    default: 'General',
    trim: true
  },
  qualification: {
    type: String,
    default: '',
    trim: true
  },
  bio: {
    type: String,
    default: 'New doctor pending verification.',
    trim: true
  },
  consultationFee: {
    type: Number,
    default: 500
  },
  profileImage: {
    type: String,
    default: '' // path to uploaded file or empty
  },
  resume: {
    type: String,
    default: '' // path to uploaded resume/bio file
  },
  availability: [SlotSchema], // individual date+time slots
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: 'Male'
  },
  role: {
    type: String,
    default: 'doctor'
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: undefined
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  ratings: {
    type: [{
      patientName: String,
      score: Number,
      reviewText: String,
      createdAt: { type: Date, default: Date.now }
    }],
    default: [
      { patientName: "Rahul Sharma", score: 5, reviewText: "Extremely helpful consultation. Explained PEP process in detail and cleared all doubts." },
      { patientName: "Amana Gupta", score: 4, reviewText: "Prompt response and guidance for PrEP routine." }
    ]
  }
}, {
  timestamps: true
});

// Indexes for performant AI booking queries
DoctorSchema.index({ isApproved: 1 });
DoctorSchema.index({ 'availability.isBooked': 1 });

// Pre-save hook to hash password
DoctorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method to check password validity
DoctorSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Doctor', DoctorSchema);

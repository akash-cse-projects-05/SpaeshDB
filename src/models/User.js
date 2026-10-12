const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
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
  age: {
    type: Number,
    required: true
  },
  contact: {
    type: String,
    required: true,
    trim: true
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['patient', 'admin'],
    default: 'patient'
  },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    default: undefined
  },
  whatsappSession: {
    state: {
      type: String,
      default: 'IDLE'
    },
    tempBookingData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  // PEP 72-hour countdown: when exposure occurred
  pepExposureDate: {
    type: Date,
    default: null
  },
  // PrEP daily adherence tracker
  prepTracking: {
    isActive: {
      type: Boolean,
      default: false
    },
    startDate: {
      type: Date,
      default: null
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    adherenceLog: [
      {
        date: { type: String }, // YYYY-MM-DD
        taken: { type: Boolean, default: false }
      }
    ]
  },
  primaryDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    default: null
  }
}, {
  timestamps: true
});

// Pre-save hook to hash password
UserSchema.pre('save', async function(next) {
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
UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);

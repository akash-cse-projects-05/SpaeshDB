const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['patient', 'doctor'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isEncrypted: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const PrescriptionSchema = new mongoose.Schema({
  notes: {
    type: String,
    default: ''
  },
  medication: {
    type: String,
    default: ''
  },
  dosage: {
    type: String,
    default: ''
  },
  verificationPin: {
    type: String,
    default: () => Math.floor(1000 + Math.random() * 9000).toString() // 4-digit PIN
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const AppointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  consultationType: {
    type: String,
    enum: ['PEP', 'PrEP', 'General Counselling'],
    required: true
  },
  consultationMode: {
    type: String,
    enum: ['Video Consultation', 'Phone Consultation', 'Text Chat'],
    default: 'Video Consultation'
  },
  appointmentSlot: {
    date: {
      type: Date,
      required: true
    },
    time: {
      type: String, // e.g. "09:00 - 10:00"
      required: true
    }
  },
  patientHistory: {
    type: String,
    default: ''
  },
  patientContact: {
    method: {
      type: String,
      enum: ['Email', 'Phone'],
      required: true
    },
    value: {
      type: String,
      required: true
    }
  },
  paymentDetails: {
    amount: {
      type: Number,
      required: true
    },
    transactionId: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending'
    }
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  prescription: {
    type: PrescriptionSchema,
    default: () => ({})
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  messages: [MessageSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Appointment', AppointmentSchema);

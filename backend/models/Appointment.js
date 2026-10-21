const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  studentEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  counsellor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  counsellorName: {
    type: String,
    required: true,
    trim: true
  },
  counsellorEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  counsellorDesignation: {
    type: String,
    trim: true,
    default: 'Campus Counsellor'
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  sessionType: {
    type: String,
    enum: ['chat', 'meet'],
    required: true,
    default: 'chat'
  },
  meetingLink: {
    type: String,
    trim: true
  },
  concern: {
    type: String,
    trim: true,
    default: 'General Mental Health Support'
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  counsellorFeedback: {
    type: String,
    trim: true
  },
  improvementRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  feedbackDate: {
    type: Date
  },
  actionItems: [{
    type: String,
    trim: true
  }],
  confirmationToken: {
    type: String,
    index: true
  },
  confirmedAt: {
    type: Date
  },
  mailSentToCounsellor: {
    type: Boolean,
    default: false
  },
  mailSentToStudent: {
    type: Boolean,
    default: false
  },
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderName: {
      type: String,
      required: true,
      trim: true
    },
    senderRole: {
      type: String,
      enum: ['student', 'counsellor', 'admin'],
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('Appointment', appointmentSchema);

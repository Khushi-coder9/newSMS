const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  userName: {
    type: String,
    trim: true
  },
  userRole: {
    type: String,
    enum: ['student', 'counsellor', 'admin'],
    default: 'student'
  },
  sender: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  detectedKeywords: [{
    type: String
  }],
  detectedDifficulties: [{
    type: String
  }],
  severity: {
    type: String,
    enum: ['normal', 'moderate', 'crisis'],
    default: 'normal'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);

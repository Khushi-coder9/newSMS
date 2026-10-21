const mongoose = require('mongoose');

const dailyCheckInSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestSessionId: { type: String, default: null },
  mood: {
    type: String,
    enum: ['Good', 'Okay', 'Low', 'Anxious', 'Overwhelmed'],
    required: true
  },
  supportIntent: {
    type: String,
    enum: [
      'I need someone to listen.',
      'I need advice from someone with a similar experience.',
      'I want to celebrate a small win.',
      'I just want to feel connected.',
      'Just tracking my mood privately'
    ],
    default: 'Just tracking my mood privately'
  },
  note: { type: String, maxlength: 400, default: '' },
  isShared: { type: Boolean, default: false },
  dateString: { type: String, required: true }, // e.g. '2026-10-21'
  createdAt: { type: Date, default: Date.now }
});

dailyCheckInSchema.index({ userId: 1, dateString: 1 });

module.exports = mongoose.model('DailyCheckIn', dailyCheckInSchema);

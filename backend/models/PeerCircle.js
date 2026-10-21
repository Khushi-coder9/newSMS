const mongoose = require('mongoose');

const circleMessageSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  authorPseudonym: { type: String, default: 'Circle Member' },
  authorAvatar: { type: String, default: '🌟' },
  content: { type: String, required: true, maxlength: 1200 },
  isAnonymous: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const peerCircleSchema = new mongoose.Schema({
  circleId: { type: String, required: true, unique: true }, // e.g. 'exam-stress', 'new-to-college'
  name: { type: String, required: true },
  tagline: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, default: 'General' },
  icon: { type: String, default: '👥' },
  schedule: { type: String, default: 'Daily text discussion & scheduled weekly meetups' },
  meetingTime: { type: String, default: 'Thursday 6:00 PM - 7:00 PM' },
  memberCount: { type: Number, default: 0 },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [circleMessageSchema],
  moderatorNotes: { type: String, default: 'Moderated safe space for mutual student support.' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PeerCircle', peerCircleSchema);

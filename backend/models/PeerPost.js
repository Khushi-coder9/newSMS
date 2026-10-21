const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  authorPseudonym: { type: String, default: 'Kind Peer' },
  content: { type: String, required: true, maxlength: 1000 },
  isAnonymous: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const peerPostSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  authorPseudonym: { type: String, default: 'Anonymous Student' },
  authorAvatar: { type: String, default: '🌱' },
  content: { type: String, required: true, maxlength: 3000 },
  topic: {
    type: String,
    enum: [
      'Exam Stress',
      'Loneliness & Social',
      'Anxiety & Overwhelm',
      'Relationships',
      'Homesickness & College Life',
      'General'
    ],
    default: 'General'
  },
  supportIntent: {
    type: String,
    enum: [
      'I need someone to listen',
      'I need advice from someone with a similar experience',
      'I want to celebrate a small win',
      'I just want to feel connected',
      'General sharing'
    ],
    default: 'I need someone to listen'
  },
  mood: {
    type: String,
    enum: ['Good', 'Okay', 'Low', 'Anxious', 'Overwhelmed', 'Unspecified'],
    default: 'Unspecified'
  },
  isAnonymous: { type: Boolean, default: true },
  reactions: {
    hearYou: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    notAlone: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    strongForYou: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    meToo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  comments: [commentSchema],
  reports: [
    {
      reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, default: 'Inappropriate content' },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  isFlagged: { type: Boolean, default: false },
  isModerated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

peerPostSchema.index({ topic: 1, createdAt: -1 });

module.exports = mongoose.model('PeerPost', peerPostSchema);

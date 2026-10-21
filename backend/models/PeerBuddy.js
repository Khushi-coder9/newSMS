const mongoose = require('mongoose');

const peerBuddyProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  pseudonym: { type: String, default: 'Buddy Student' },
  collegeYear: { type: String, default: '1st Year' },
  preferredLanguage: { type: String, default: 'English' },
  interests: [{ type: String }],
  availability: { type: String, default: 'Flexible' },
  supportGoal: {
    type: String,
    enum: [
      'Making friends',
      'Managing academic stress',
      'Adjusting to college',
      'Staying motivated',
      'General peer support'
    ],
    default: 'Managing academic stress'
  },
  bio: { type: String, maxlength: 400, default: '' },
  isAvailable: { type: Boolean, default: true },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  isSearching: { type: Boolean, default: false },
  searchingSince: { type: Date, default: null },
  inferredFrom: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      source: 'auto_collected',
      aiChat: false,
      counsellorFeedback: false,
      dailyCheckIn: false,
      lastAnalyzed: new Date()
    })
  },
  updatedAt: { type: Date, default: Date.now }
});

peerBuddyProfileSchema.index({ isOnline: 1, isSearching: 1, lastSeen: -1 });

const buddyMessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderPseudonym: { type: String, default: 'Buddy' },
  text: { type: String, required: true, maxlength: 1500 },
  createdAt: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const peerBuddyMatchSchema = new mongoose.Schema({
  studentA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pseudonymA: { type: String, default: 'Buddy One' },
  pseudonymB: { type: String, default: 'Buddy Two' },
  sharedGoal: { type: String, default: 'Peer Support' },
  compatibilityScore: { type: Number, default: 0 },
  matchedLanguage: { type: String, default: 'English' },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  endedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  endReason: { type: String, default: '' },
  messages: [buddyMessageSchema],
  reports: [
    {
      reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, default: 'Inappropriate conduct' },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  matchedAt: { type: Date, default: Date.now }
});

peerBuddyMatchSchema.index({ studentA: 1, status: 1 });
peerBuddyMatchSchema.index({ studentB: 1, status: 1 });

const PeerBuddyProfile = mongoose.model('PeerBuddyProfile', peerBuddyProfileSchema);
const PeerBuddyMatch = mongoose.model('PeerBuddyMatch', peerBuddyMatchSchema);

module.exports = {
  PeerBuddyProfile,
  PeerBuddyMatch
};

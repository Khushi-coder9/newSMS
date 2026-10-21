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
    default: 'Making friends'
  },
  bio: { type: String, maxlength: 400, default: '' },
  isAvailable: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

const buddyMessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderPseudonym: { type: String, default: 'Buddy' },
  text: { type: String, required: true, maxlength: 1500 },
  createdAt: { type: Date, default: Date.now }
});

const peerBuddyMatchSchema = new mongoose.Schema({
  studentA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pseudonymA: { type: String, default: 'Buddy One' },
  pseudonymB: { type: String, default: 'Buddy Two' },
  sharedGoal: { type: String, default: 'Peer Support' },
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

const PeerBuddyProfile = mongoose.model('PeerBuddyProfile', peerBuddyProfileSchema);
const PeerBuddyMatch = mongoose.model('PeerBuddyMatch', peerBuddyMatchSchema);

module.exports = {
  PeerBuddyProfile,
  PeerBuddyMatch
};

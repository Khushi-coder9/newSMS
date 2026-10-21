const mongoose = require('mongoose');

const kindnessPostSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  authorPseudonym: { type: String, default: 'Kind Soul' },
  category: {
    type: String,
    enum: [
      'One small win I had today…',
      'Something I wish someone had told me…',
      'A reminder for anyone having a difficult day',
      'Weekly gratitude posts',
      'Daily Community Question'
    ],
    default: 'One small win I had today…'
  },
  content: { type: String, required: true, maxlength: 1000 },
  hearts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  heartsCount: { type: Number, default: 0 },
  colorTheme: {
    type: String,
    enum: ['sunshine', 'rose', 'mint', 'sky', 'lavender'],
    default: 'mint'
  },
  createdAt: { type: Date, default: Date.now }
});

kindnessPostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('KindnessPost', kindnessPostSchema);

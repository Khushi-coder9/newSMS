const mongoose = require('mongoose');

const StudentSurveySchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sleepHours: { type: Number, min: 0, max: 24 },
  sleepQuality: { type: String, enum: ['very_poor', 'poor', 'fair', 'good', 'excellent'] },
  physicalActivity: { type: String, enum: ['none', 'rarely', 'sometimes', 'regularly', 'daily'] },
  academicStressLevel: { type: Number, min: 1, max: 10 },
  examAnxiety: { type: String, enum: ['never', 'rarely', 'sometimes', 'often', 'always'] },
  deadlinePressure: { type: String, enum: ['never', 'rarely', 'sometimes', 'often', 'always'] },
  moodFrequency: { type: String, enum: ['mostly_positive', 'balanced', 'often_sad', 'often_anxious', 'very_low'] },
  feelingOverwhelmed: { type: String, enum: ['never', 'rarely', 'sometimes', 'often', 'always'] },
  lonelinessLevel: { type: String, enum: ['never', 'rarely', 'sometimes', 'often', 'always'] },
  copingMethods: [{ type: String, enum: ['talking_to_friends','exercise','meditation','journaling','music_art','eating','social_media','substance','seeking_professional_help','nothing'] }],
  hasSupport: { type: String, enum: ['yes_strong', 'yes_some', 'limited', 'none'] },
  concentrationDifficulty: { type: String, enum: ['never', 'rarely', 'sometimes', 'often', 'always'] },
  motivationLevel: { type: Number, min: 1, max: 10 },
  primaryConcerns: [{ type: String, enum: ['academic_pressure','exam_anxiety','depression_low_mood','social_isolation','relationship_issues','family_pressure','financial_stress','identity_self_esteem','grief_loss','substance_use','sleep_disorder','career_uncertainty','homesickness','bullying_ragging','other'] }],
  isFirstSurvey: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

StudentSurveySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('StudentSurvey', StudentSurveySchema);

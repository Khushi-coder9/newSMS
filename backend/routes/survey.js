const express = require('express');
const router = express.Router();
const StudentSurvey = require('../models/StudentSurvey');
const authMiddleware = require('../middleware/auth');

/**
 * POST /api/survey/submit
 * Submit or update a wellness intake survey for the logged-in student.
 * isFirstSurvey=true on the very first submission.
 */
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit surveys.' });
    }

    const {
      sleepHours, sleepQuality, physicalActivity,
      academicStressLevel, examAnxiety, deadlinePressure,
      moodFrequency, feelingOverwhelmed, lonelinessLevel,
      copingMethods, hasSupport,
      concentrationDifficulty, motivationLevel,
      primaryConcerns
    } = req.body;

    // Check if any previous survey exists
    const existing = await StudentSurvey.findOne({ student: userId }).sort({ createdAt: -1 });
    const isFirst = !existing;

    const survey = new StudentSurvey({
      student: userId,
      sleepHours, sleepQuality, physicalActivity,
      academicStressLevel, examAnxiety, deadlinePressure,
      moodFrequency, feelingOverwhelmed, lonelinessLevel,
      copingMethods: Array.isArray(copingMethods) ? copingMethods : [],
      hasSupport,
      concentrationDifficulty, motivationLevel,
      primaryConcerns: Array.isArray(primaryConcerns) ? primaryConcerns : [],
      isFirstSurvey: isFirst,
      version: 1
    });

    await survey.save();

    res.status(201).json({
      message: 'Survey submitted successfully.',
      surveyId: survey._id,
      isFirstSurvey: isFirst
    });
  } catch (err) {
    console.error('Survey submit error:', err);
    res.status(500).json({ error: 'Failed to submit survey.' });
  }
});

/**
 * GET /api/survey/status
 * Check whether the logged-in student has ever submitted a survey.
 * Returns { hasSurvey: boolean, latestSurveyDate: Date|null }
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'student') {
      return res.json({ hasSurvey: false, latestSurveyDate: null });
    }

    const latest = await StudentSurvey.findOne({ student: userId }).sort({ createdAt: -1 }).lean();
    res.json({
      hasSurvey: !!latest,
      latestSurveyDate: latest ? latest.createdAt : null
    });
  } catch (err) {
    console.error('Survey status error:', err);
    res.status(500).json({ error: 'Failed to check survey status.' });
  }
});

/**
 * GET /api/survey/latest
 * Fetch the latest survey data for the logged-in student (for pre-filling optional re-fill).
 */
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = (req.user.role || '').toLowerCase();
    if (role !== 'student') {
      return res.status(403).json({ error: 'Only students can view their survey data.' });
    }
    const latest = await StudentSurvey.findOne({ student: userId }).sort({ createdAt: -1 }).lean();
    if (!latest) return res.status(404).json({ error: 'No survey found.' });
    res.json(latest);
  } catch (err) {
    console.error('Survey latest error:', err);
    res.status(500).json({ error: 'Failed to fetch survey.' });
  }
});

module.exports = router;

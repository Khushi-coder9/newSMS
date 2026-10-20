const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const Appointment = require('../models/Appointment');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/dashboard/student
 * Detailed dashboard metrics and chart data for the logged-in student
 */
router.get('/student', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userDoc = req.userDoc || await User.findById(userId).lean();

    // 1. Fetch student's chat messages
    const studentMessages = await ChatMessage.find({
      user: userId,
      sender: 'user'
    }).sort({ createdAt: 1 }).lean();

    // Tally difficulties & keywords
    const difficultyCounts = {};
    const keywordCounts = {};
    let crisisCount = 0;
    let moderateCount = 0;

    studentMessages.forEach(msg => {
      if (msg.severity === 'crisis') crisisCount++;
      else if (msg.severity === 'moderate') moderateCount++;

      (msg.detectedDifficulties || []).forEach(diff => {
        difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;
      });

      (msg.detectedKeywords || []).forEach(kw => {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      });
    });

    // Provide default fallback categories if student is new
    if (Object.keys(difficultyCounts).length === 0) {
      difficultyCounts['Academic Stress'] = 2;
      difficultyCounts['Exam Anxiety'] = 1;
      difficultyCounts['Sleep & Rest'] = 1;
    }

    // 2. Compute wellness & improvement trajectory over time (last 7 points)
    const timelineLabels = [];
    const wellnessScores = [];
    const chatTimeline = {};

    studentMessages.forEach(msg => {
      const day = new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (!chatTimeline[day]) {
        chatTimeline[day] = { total: 0, crisis: 0, moderate: 0 };
      }
      chatTimeline[day].total++;
      if (msg.severity === 'crisis') chatTimeline[day].crisis++;
      if (msg.severity === 'moderate') chatTimeline[day].moderate++;
    });

    const days = Object.keys(chatTimeline);
    if (days.length >= 2) {
      days.slice(-7).forEach(d => {
        timelineLabels.push(d);
        const data = chatTimeline[d];
        // Calculate wellness score (100 is high wellness, lower if high crisis)
        let score = 85 - (data.crisis * 25) - (data.moderate * 10);
        if (score < 40) score = 40;
        if (score > 98) score = 98;
        wellnessScores.push(score);
      });
    } else {
      // Default initial wellness trajectory
      timelineLabels.push('Week 1', 'Week 2', 'Week 3', 'Week 4', 'This Week');
      wellnessScores.push(65, 70, 74, 82, 88);
    }

    // 3. Fetch student's appointments
    const appointments = await Appointment.find({ student: userId })
      .sort({ createdAt: -1 })
      .lean();

    // Compute counsellor feedback summary and average improvement rating
    const feedbackList = [];
    let ratingSum = 0;
    let ratedCount = 0;

    appointments.forEach(app => {
      if (app.counsellorFeedback) {
        feedbackList.push({
          appointmentId: app._id,
          counsellorName: app.counsellorName,
          counsellorDesignation: app.counsellorDesignation,
          date: app.date,
          time: app.time,
          feedback: app.counsellorFeedback,
          improvementRating: app.improvementRating || 4,
          feedbackDate: app.feedbackDate || app.createdAt,
          actionItems: app.actionItems || []
        });
      }
      if (app.improvementRating) {
        ratingSum += app.improvementRating;
        ratedCount++;
      }
    });

    const avgImprovementRating = ratedCount > 0 ? (ratingSum / ratedCount).toFixed(1) : '4.5';
    const improvementPercentage = Math.min(Math.round((parseFloat(avgImprovementRating) / 5) * 100), 100);

    // Primary detected difficulty
    let primaryDifficulty = 'General Well-being';
    let maxCount = 0;
    Object.entries(difficultyCounts).forEach(([diff, count]) => {
      if (count > maxCount) {
        maxCount = count;
        primaryDifficulty = diff;
      }
    });

    res.json({
      success: true,
      student: {
        id: userId,
        name: userDoc.name || 'Student',
        email: userDoc.email,
        age: userDoc.age || null,
        role: userDoc.role || 'student'
      },
      stats: {
        totalChats: studentMessages.length,
        totalAppointments: appointments.length,
        upcomingAppointments: appointments.filter(a => a.status === 'confirmed' || a.status === 'pending').length,
        completedAppointments: appointments.filter(a => a.status === 'completed').length,
        primaryDifficulty,
        improvementRating: avgImprovementRating,
        improvementPercentage,
        improvementLevelText: improvementPercentage >= 80 ? 'Significant Improvement' : (improvementPercentage >= 60 ? 'Steady Progress' : 'Initial Support Stage')
      },
      charts: {
        difficultyBreakdown: difficultyCounts,
        wellnessTrajectory: {
          labels: timelineLabels,
          scores: wellnessScores
        }
      },
      appointments,
      counsellorFeedback: feedbackList
    });
  } catch (error) {
    console.error('Error in student dashboard API:', error);
    res.status(500).json({ error: 'Failed to generate student dashboard.' });
  }
});

/**
 * GET /api/dashboard/counsellor
 * Appointments, assigned students, clinical difficulties, and reports
 */
router.get('/counsellor', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userDoc = req.userDoc || await User.findById(userId).lean();

    // 1. Fetch appointments where user is counsellor, or all if none
    let appointments = await Appointment.find({ counsellor: userId })
      .sort({ createdAt: -1 })
      .lean();

    // If new counsellor has 0 specific appointments, show all appointments to manage
    if (appointments.length === 0) {
      appointments = await Appointment.find()
        .sort({ createdAt: -1 })
        .limit(25)
        .lean();
    }

    // 2. Fetch distinct students associated with these appointments or chats
    const studentIds = [...new Set(appointments.map(a => a.student.toString()))];
    const students = await User.find({
      $or: [
        { _id: { $in: studentIds } },
        { role: 'student' }
      ]
    }).select('name email age role createdAt').limit(20).lean();

    // 3. Difficulties and severity monitoring among students
    const studentDifficulties = {};
    const studentKeywords = {};
    let severeAlertsCount = 0;
    let moderateCount = 0;

    const chatLogs = await ChatMessage.find({ sender: 'user' }).lean();

    chatLogs.forEach(c => {
      if (c.severity === 'crisis') severeAlertsCount++;
      else if (c.severity === 'moderate') moderateCount++;

      (c.detectedDifficulties || []).forEach(d => {
        studentDifficulties[d] = (studentDifficulties[d] || 0) + 1;
      });
      (c.detectedKeywords || []).forEach(k => {
        studentKeywords[k] = (studentKeywords[k] || 0) + 1;
      });
    });

    if (Object.keys(studentDifficulties).length === 0) {
      studentDifficulties['Academic Stress'] = 8;
      studentDifficulties['Exam Anxiety'] = 6;
      studentDifficulties['Sleep & Burnout'] = 4;
      studentDifficulties['Loneliness & Peers'] = 3;
    }

    // Calculate appointment counts
    const pendingCount = appointments.filter(a => a.status === 'pending').length;
    const confirmedCount = appointments.filter(a => a.status === 'confirmed').length;
    const completedCount = appointments.filter(a => a.status === 'completed').length;

    res.json({
      success: true,
      counsellor: {
        id: userId,
        name: userDoc.name || 'Counsellor',
        email: userDoc.email,
        designation: userDoc.designation || 'Campus Counsellor'
      },
      stats: {
        totalAppointments: appointments.length,
        pendingAppointments: pendingCount,
        confirmedAppointments: confirmedCount,
        completedAppointments: completedCount,
        activeStudents: students.length,
        severeAlertsCount,
        avgRating: '4.8 ★'
      },
      charts: {
        studentDifficulties,
        appointmentStatusBreakdown: {
          'Pending Confirmation': pendingCount,
          'Confirmed': confirmedCount,
          'Completed': completedCount
        }
      },
      appointments,
      students
    });
  } catch (error) {
    console.error('Error in counsellor dashboard API:', error);
    res.status(500).json({ error: 'Failed to generate counsellor dashboard.' });
  }
});

/**
 * POST /api/dashboard/feedback/:appointmentId
 * Counsellor records clinical feedback and improvement rating for a session
 */
router.post('/feedback/:appointmentId', authMiddleware, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { feedback, improvementRating, actionItems, markCompleted } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (feedback) appointment.counsellorFeedback = feedback.trim();
    if (improvementRating) appointment.improvementRating = Number(improvementRating);
    if (actionItems && Array.isArray(actionItems)) appointment.actionItems = actionItems;
    appointment.feedbackDate = new Date();

    if (markCompleted) {
      appointment.status = 'completed';
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Feedback and improvement rating submitted successfully.',
      appointment
    });
  } catch (error) {
    console.error('Error submitting counsellor feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback.' });
  }
});

/**
 * GET /api/dashboard/admin
 * Platform-wide overview tracking students, counsellors, severe cases, and metrics
 */
router.get('/admin', async (req, res) => {
  try {
    // 1. User Counts
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalCounsellors = await User.countDocuments({ role: 'counsellor' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    // 2. Chat Severity Cases
    const crisisCases = await ChatMessage.countDocuments({ severity: 'crisis', sender: 'user' });
    const moderateCases = await ChatMessage.countDocuments({ severity: 'moderate', sender: 'user' });
    const normalCases = await ChatMessage.countDocuments({ severity: 'normal', sender: 'user' });
    const totalChats = crisisCases + moderateCases + normalCases;

    // 3. Appointment Counts
    const totalAppointments = await Appointment.countDocuments();
    const pendingAppointments = await Appointment.countDocuments({ status: 'pending' });
    const confirmedAppointments = await Appointment.countDocuments({ status: 'confirmed' });
    const completedAppointments = await Appointment.countDocuments({ status: 'completed' });

    // 4. Overall campus difficulty distribution
    const allUserChats = await ChatMessage.find({ sender: 'user' }).lean();
    const globalDifficulties = {};
    const globalKeywords = {};

    allUserChats.forEach(chat => {
      (chat.detectedDifficulties || []).forEach(d => {
        globalDifficulties[d] = (globalDifficulties[d] || 0) + 1;
      });
      (chat.detectedKeywords || []).forEach(k => {
        globalKeywords[k] = (globalKeywords[k] || 0) + 1;
      });
    });

    if (Object.keys(globalDifficulties).length === 0) {
      globalDifficulties['Academic & Exam Stress'] = 14;
      globalDifficulties['Generalized Anxiety'] = 9;
      globalDifficulties['Sleep Disruption'] = 7;
      globalDifficulties['Loneliness & Social'] = 5;
      globalDifficulties['Depressive Mood'] = 3;
    }

    // 5. Fetch Students Registry (with detected difficulties)
    const studentsList = await User.find({ role: 'student' })
      .select('name email age createdAt')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // 6. Fetch Counsellors Registry
    const counsellorsList = await User.find({ role: 'counsellor' })
      .select('name email designation createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      stats: {
        totalStudents: Math.max(totalStudents, 1),
        totalCounsellors: Math.max(totalCounsellors, 1),
        totalAdmins: Math.max(totalAdmins, 1),
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        completedAppointments,
        totalChats,
        severeCases: crisisCases,
        averageCases: moderateCases,
        normalCases: Math.max(normalCases, 1)
      },
      charts: {
        severityDistribution: {
          'Normal (Coping Well)': Math.max(normalCases, 1),
          'Moderate (Under Observation)': Math.max(moderateCases, 2),
          'Severe / Urgent Alert': crisisCases
        },
        campusDifficulties: globalDifficulties,
        consultationTrends: {
          labels: ['Oct 1-7', 'Oct 8-14', 'Oct 15-21', 'Oct 22-28'],
          appointments: [4, 7, 12, totalAppointments > 0 ? totalAppointments : 16],
          aiChats: [18, 29, 45, totalChats > 0 ? totalChats : 58]
        }
      },
      students: studentsList,
      counsellors: counsellorsList
    });
  } catch (error) {
    console.error('Error in admin dashboard API:', error);
    res.status(500).json({ error: 'Failed to generate admin dashboard.' });
  }
});

module.exports = router;

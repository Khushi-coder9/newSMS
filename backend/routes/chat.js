const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { analyzeMessage, DIFFICULTY_DEFINITIONS } = require('../utils/difficultyAnalyzer');

/**
 * POST /api/chat/save
 * Saves a user message and optional bot reply, running difficulty and keyword analysis.
 */
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { userMessage, botReply, message, sender } = req.body;
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const userName = req.userDoc ? req.userDoc.name : 'Student';
    const userRole = req.user.role || 'student';

    const savedMessages = [];
    let analysisResult = null;

    // Case 1: userMessage + botReply pair sent together
    if (userMessage) {
      analysisResult = analyzeMessage(userMessage);

      const userChat = new ChatMessage({
        user: userId,
        userEmail,
        userName,
        userRole,
        sender: 'user',
        message: userMessage.trim(),
        detectedKeywords: analysisResult.detectedKeywords,
        detectedDifficulties: analysisResult.detectedDifficulties,
        severity: analysisResult.severity
      });

      const savedUserChat = await userChat.save();
      savedMessages.push(savedUserChat);

      if (botReply) {
        const botChat = new ChatMessage({
          user: userId,
          userEmail,
          userName,
          userRole,
          sender: 'assistant',
          message: botReply.trim(),
          detectedKeywords: [],
          detectedDifficulties: [],
          severity: 'normal'
        });
        const savedBotChat = await botChat.save();
        savedMessages.push(savedBotChat);
      }
    } else if (message) {
      // Case 2: Single message sent
      const isUser = (sender || 'user') === 'user';
      if (isUser) {
        analysisResult = analyzeMessage(message);
      }

      const chat = new ChatMessage({
        user: userId,
        userEmail,
        userName,
        userRole,
        sender: sender || 'user',
        message: message.trim(),
        detectedKeywords: analysisResult ? analysisResult.detectedKeywords : [],
        detectedDifficulties: analysisResult ? analysisResult.detectedDifficulties : [],
        severity: analysisResult ? analysisResult.severity : 'normal'
      });

      const saved = await chat.save();
      savedMessages.push(saved);
    } else {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    res.status(201).json({
      success: true,
      message: 'Chat saved successfully',
      analysis: analysisResult,
      saved: savedMessages
    });
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({ error: 'Failed to save chat message.' });
  }
});

/**
 * GET /api/chat/history
 * Retrieves chat history for the authenticated user
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit, 10) || 60;

    const messages = await ChatMessage.find({ user: userId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history.' });
  }
});

/**
 * GET /api/chat/my-difficulties
 * Returns difficulty categories and keywords detected for the logged-in user
 */
router.get('/my-difficulties', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userMessages = await ChatMessage.find({
      user: userId,
      sender: 'user'
    }).lean();

    const difficultyCounts = {};
    const keywordCounts = {};
    let hasCrisis = false;

    for (const msg of userMessages) {
      if (msg.severity === 'crisis') hasCrisis = true;

      for (const diff of msg.detectedDifficulties || []) {
        difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;
      }

      for (const kw of msg.detectedKeywords || []) {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      }
    }

    const sortedKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, count]) => ({ keyword, count }));

    res.json({
      success: true,
      totalUserMessages: userMessages.length,
      difficultyCounts,
      topKeywords: sortedKeywords.slice(0, 10),
      hasCrisis
    });
  } catch (error) {
    console.error('Error fetching student difficulties:', error);
    res.status(500).json({ error: 'Failed to fetch difficulty metrics.' });
  }
});

/**
 * GET /api/chat/monitoring
 * Provides comprehensive monitoring of difficulties and keywords across students.
 * (Accessible by Counsellors, Admins, and for Platform Analytics)
 */
router.get('/monitoring', async (req, res) => {
  try {
    // Fetch all user chat messages from students
    const userMessages = await ChatMessage.find({ sender: 'user' })
      .sort({ createdAt: -1 })
      .populate('user', 'name email role age designation')
      .lean();

    const studentMap = {};
    const overallDifficultyCounts = {};
    const overallKeywordCounts = {};
    const crisisAlerts = [];

    for (const msg of userMessages) {
      const uId = msg.user ? (msg.user._id ? msg.user._id.toString() : msg.user.toString()) : msg.userEmail;
      const studentName = (msg.user && msg.user.name) || msg.userName || 'Student';
      const studentEmail = (msg.user && msg.user.email) || msg.userEmail;
      const studentAge = (msg.user && msg.user.age) || null;
      const studentRole = (msg.user && msg.user.role) || msg.userRole || 'student';

      if (!studentMap[uId]) {
        studentMap[uId] = {
          userId: uId,
          name: studentName,
          email: studentEmail,
          age: studentAge,
          role: studentRole,
          totalMessages: 0,
          difficulties: {},
          keywords: {},
          highestSeverity: 'normal',
          lastActive: msg.createdAt,
          recentSnippet: msg.message
        };
      }

      const entry = studentMap[uId];
      entry.totalMessages += 1;

      // Track difficulties
      for (const diff of msg.detectedDifficulties || []) {
        entry.difficulties[diff] = (entry.difficulties[diff] || 0) + 1;
        overallDifficultyCounts[diff] = (overallDifficultyCounts[diff] || 0) + 1;
      }

      // Track keywords
      for (const kw of msg.detectedKeywords || []) {
        entry.keywords[kw] = (entry.keywords[kw] || 0) + 1;
        overallKeywordCounts[kw] = (overallKeywordCounts[kw] || 0) + 1;
      }

      // Severity check
      if (msg.severity === 'crisis') {
        entry.highestSeverity = 'crisis';
      } else if (msg.severity === 'moderate' && entry.highestSeverity !== 'crisis') {
        entry.highestSeverity = 'moderate';
      }
    }

    // Convert student map to array
    const studentList = Object.values(studentMap).map(s => {
      const topKeywords = Object.entries(s.keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([kw]) => kw);

      const topDifficulties = Object.entries(s.difficulties)
        .sort((a, b) => b[1] - a[1])
        .map(([diff, count]) => ({ category: diff, count }));

      if (s.highestSeverity === 'crisis') {
        crisisAlerts.push({
          userId: s.userId,
          name: s.name,
          email: s.email,
          lastActive: s.lastActive,
          recentSnippet: s.recentSnippet
        });
      }

      return {
        ...s,
        topKeywords,
        topDifficulties
      };
    });

    const topKeywordsOverall = Object.entries(overallKeywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword, count]) => ({ keyword, count }));

    res.json({
      success: true,
      totalMonitoredMessages: userMessages.length,
      totalMonitoredStudents: studentList.length,
      difficultyDistribution: overallDifficultyCounts,
      topKeywordsOverall,
      crisisAlerts,
      students: studentList
    });
  } catch (error) {
    console.error('Error generating monitoring data:', error);
    res.status(500).json({ error: 'Failed to generate monitoring analytics.' });
  }
});

module.exports = router;

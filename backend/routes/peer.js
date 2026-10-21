const express = require('express');
const router = express.Router();
const PeerPost = require('../models/PeerPost');
const { PeerBuddyProfile, PeerBuddyMatch } = require('../models/PeerBuddy');
const PeerCircle = require('../models/PeerCircle');
const KindnessPost = require('../models/KindnessPost');
const DailyCheckIn = require('../models/DailyCheckIn');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Soft auth helper: extracts user if token provided, but doesn't block unauthenticated browsing
function getAuthUser(req) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        return jwt.verify(token, JWT_SECRET);
      }
    }
  } catch (e) {
    // invalid token, treat as guest
  }
  return null;
}

// Pseudonym generator for anonymous student posts & comments
const ADJECTIVES = ['Gentle', 'Thoughtful', 'Resilient', 'Quiet', 'Hopeful', 'Brave', 'Compassionate', 'Calm', 'Warm', 'Mindful', 'Patient', 'Curious'];
const NOUNS = ['Sparrow', 'River', 'Willow', 'Panda', 'Otter', 'Pine', 'Robin', 'Breeze', 'Sunbeam', 'Finch', 'Starlight', 'Oak'];

function generatePseudonym() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

const AVATARS = ['🌱', '🌿', '🍃', '🌸', '✨', '🌊', '🌻', '🕊️', '⛅', '🦉'];
function getRandomAvatar() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

// ---------------------------------------------------------------------------
// DEFAULT SEED DATA HELPER (Runs once if DB collections are empty)
// ---------------------------------------------------------------------------
async function ensureSeedData() {
  try {
    // 1. Seed Circles if empty
    const circleCount = await PeerCircle.countDocuments();
    if (circleCount === 0) {
      const defaultCircles = [
        {
          circleId: 'exam-stress',
          name: 'Exam Stress Club',
          tagline: 'Study pressure, prep fatigue & exam anxiety',
          description: 'A dedicated sanctuary for students tackling midterms, finals, and competitive exams. Swap study tips, destress together, and breathe.',
          category: 'Academics',
          icon: '📚',
          schedule: 'Daily Open Chat • Live Moderator Q&A Wednesdays 7:00 PM',
          meetingTime: 'Wednesdays 7:00 PM',
          memberCount: 42,
          messages: [
            {
              authorPseudonym: 'Calm Willow',
              authorAvatar: '🌿',
              content: 'Remember that your grades do not define your human worth. Take a 15-minute hydration break today!',
              createdAt: new Date(Date.now() - 3600000 * 5)
            },
            {
              authorPseudonym: 'Resilient Finch',
              authorAvatar: '✨',
              content: 'Using the Pomodoro technique (25 min study / 5 min walk) helped me stop spiraling before my engineering midterms.',
              createdAt: new Date(Date.now() - 3600000 * 2)
            }
          ]
        },
        {
          circleId: 'new-to-college',
          name: 'New to College',
          tagline: 'Homesickness, campus navigation & making friends',
          description: 'Adjusting to hostel life, roommates, and a new city is tough. Connect with seniors and peers who have walked the same path.',
          category: 'Life & Transition',
          icon: '🎒',
          schedule: 'Daily Open Chat • Senior Mentor Hangout Sundays 5:00 PM',
          meetingTime: 'Sundays 5:00 PM',
          memberCount: 38,
          messages: [
            {
              authorPseudonym: 'Warm Sunbeam',
              authorAvatar: '🌻',
              content: 'If you are crying in your dorm room tonight because you miss your family’s food, know that almost everyone felt that week 1.',
              createdAt: new Date(Date.now() - 3600000 * 8)
            }
          ]
        },
        {
          circleId: 'confidence-corner',
          name: 'Confidence Corner',
          tagline: 'Self-esteem, imposter syndrome & social anxiety',
          description: 'Overcome fear of speaking up in lectures, group projects, and campus social scenes. Celebrate your authentic strengths.',
          category: 'Personal Growth',
          icon: '🌱',
          schedule: 'Daily Open Chat • Weekly Confidence Booster Tuesdays 6:30 PM',
          meetingTime: 'Tuesdays 6:30 PM',
          memberCount: 29,
          messages: [
            {
              authorPseudonym: 'Brave Sparrow',
              authorAvatar: '🕊️',
              content: 'Everyone in the auditorium is usually thinking about their own insecurities, not judging yours.',
              createdAt: new Date(Date.now() - 3600000 * 4)
            }
          ]
        },
        {
          circleId: 'sleep-balance',
          name: 'Sleep & Balance',
          tagline: 'Routines, circadian rest & burnout prevention',
          description: 'Break free from late-night doom-scrolling, caffeine overdrive, and chronic academic exhaustion.',
          category: 'Wellness',
          icon: '🌙',
          schedule: 'Daily Open Chat • Guided Wind-Down Sessions Daily 10:30 PM',
          meetingTime: 'Daily 10:30 PM',
          memberCount: 35,
          messages: [
            {
              authorPseudonym: 'Gentle River',
              authorAvatar: '🌊',
              content: 'Setting phone screen to greyscale after 10 PM helped my sleep quality tremendously this semester.',
              createdAt: new Date(Date.now() - 3600000 * 12)
            }
          ]
        },
        {
          circleId: 'breakup-emotional',
          name: 'Breakup & Emotional Support',
          tagline: 'Coping with relationship changes, heartbreak & grief',
          description: 'A non-judgmental shoulder when friendships change, relationships end, or feelings get overwhelming.',
          category: 'Relationships',
          icon: '💜',
          schedule: 'Daily Open Chat • Healing Circle Fridays 8:00 PM',
          meetingTime: 'Fridays 8:00 PM',
          memberCount: 24,
          messages: [
            {
              authorPseudonym: 'Hopeful Oak',
              authorAvatar: '🍃',
              content: 'Take it one hour at a time. It feels like an unbearable knot in your chest right now, but your heart will heal.',
              createdAt: new Date(Date.now() - 3600000 * 6)
            }
          ]
        }
      ];
      await PeerCircle.insertMany(defaultCircles);
    }

    // 2. Seed Community Posts if empty
    const postCount = await PeerPost.countDocuments();
    if (postCount === 0) {
      const defaultPosts = [
        {
          authorPseudonym: 'Anonymous student',
          authorAvatar: '🌱',
          content: 'Does anyone else feel guilty whenever they take an evening break from studying? Like even if I did 6 hours of work, sitting down to watch an episode makes me panic about upcoming exams.',
          topic: 'Exam Stress',
          supportIntent: 'I need advice from someone with a similar experience',
          mood: 'Anxious',
          isAnonymous: true,
          reactions: { hearYou: [], notAlone: [], strongForYou: [], meToo: [] },
          comments: [
            {
              authorPseudonym: 'Mindful Otter',
              content: '100% relate. What helped me was treating rest as a non-negotiable part of the study strategy, not a reward. A tired brain retains almost nothing!',
              isAnonymous: true,
              createdAt: new Date(Date.now() - 3600000 * 2)
            },
            {
              authorPseudonym: 'Calm Willow',
              content: 'You worked 6 hours! That is huge dedication. Allow your brain time to consolidate that memory.',
              isAnonymous: true,
              createdAt: new Date(Date.now() - 3600000 * 1)
            }
          ],
          createdAt: new Date(Date.now() - 3600000 * 3)
        },
        {
          authorPseudonym: 'First-Year Student',
          authorAvatar: '🎒',
          content: 'It’s my 3rd week living away from home at hostel. Everyone else in the mess hall seems to have already formed friend groups, and I’m eating alone feeling like an outsider.',
          topic: 'Homesickness & College Life',
          supportIntent: 'I need someone to listen',
          mood: 'Low',
          isAnonymous: true,
          reactions: { hearYou: [], notAlone: [], strongForYou: [], meToo: [] },
          comments: [
            {
              authorPseudonym: 'Senior Mentor',
              content: 'I promise you those "tight friend groups" formed in week 1 reshuffle completely within a month. Join a club or peer circle here — the genuine friendships take a little time.',
              isAnonymous: true,
              createdAt: new Date(Date.now() - 3600000 * 4)
            }
          ],
          createdAt: new Date(Date.now() - 3600000 * 7)
        },
        {
          authorPseudonym: 'Quiet Thinker',
          authorAvatar: '✨',
          content: 'Just gave my first presentation without having a panic attack in the bathroom beforehand! My hands still shook, but I finished the whole slide deck. Wanted to share because last month I thought I would drop out.',
          topic: 'General',
          supportIntent: 'I want to celebrate a small win',
          mood: 'Good',
          isAnonymous: true,
          reactions: { hearYou: [], notAlone: [], strongForYou: [], meToo: [] },
          comments: [
            {
              authorPseudonym: 'Warm Sunbeam',
              content: 'YES! So proud of you!! Shaky hands still count as showing up and doing it. Huge milestone! 🎉',
              isAnonymous: true,
              createdAt: new Date(Date.now() - 3600000 * 1)
            }
          ],
          createdAt: new Date(Date.now() - 3600000 * 5)
        }
      ];
      await PeerPost.insertMany(defaultPosts);
    }

    // 3. Seed Kindness Wall if empty
    const kindnessCount = await KindnessPost.countDocuments();
    if (kindnessCount === 0) {
      const defaultKindness = [
        {
          authorPseudonym: 'Friendly Senior',
          category: 'Something I wish someone had told me…',
          content: 'One low grade in your first semester will not ruin your career. Employers care infinitely more about your curiosity, projects, and character than one 8 AM quiz.',
          heartsCount: 14,
          colorTheme: 'sunshine',
          createdAt: new Date(Date.now() - 3600000 * 12)
        },
        {
          authorPseudonym: 'Gentle Soul',
          category: 'A reminder for anyone having a difficult day',
          content: 'You don’t have to have your whole 10-year life mapped out today. Just make your bed, drink a glass of water, and survive until sunset with kindness toward yourself.',
          heartsCount: 22,
          colorTheme: 'mint',
          createdAt: new Date(Date.now() - 3600000 * 8)
        },
        {
          authorPseudonym: 'Engineering 2nd Yr',
          category: 'One small win I had today…',
          content: 'I submitted my assignment 20 minutes before deadline instead of pulling an all-nighter for once! Sleeping at 11 PM feels like a luxury.',
          heartsCount: 9,
          colorTheme: 'rose',
          createdAt: new Date(Date.now() - 3600000 * 4)
        },
        {
          authorPseudonym: 'Anonymous',
          category: 'Weekly gratitude posts',
          content: 'Grateful for the library staff who smile when we stay late, and for the tea stall right outside the campus gate.',
          heartsCount: 16,
          colorTheme: 'lavender',
          createdAt: new Date(Date.now() - 3600000 * 18)
        }
      ];
      await KindnessPost.insertMany(defaultKindness);
    }
  } catch (err) {
    console.error('Peer seed data error:', err);
  }
}

// Trigger initial seed on startup
ensureSeedData();

// ---------------------------------------------------------------------------
// 1. ANONYMOUS SUPPORT COMMUNITY ENDPOINTS
// ---------------------------------------------------------------------------

// GET /api/peer/posts — list posts with topic filter & search
router.get('/posts', async (req, res) => {
  try {
    await ensureSeedData();
    const { topic, search, sort = 'latest' } = req.query;
    const query = { isFlagged: { $ne: true } };

    if (topic && topic !== 'All') {
      query.topic = topic;
    }

    if (search && search.trim()) {
      query.content = { $regex: search.trim(), $options: 'i' };
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'popular') {
      sortOptions = { 'reactions.notAlone': -1, createdAt: -1 };
    }

    const posts = await PeerPost.find(query).sort(sortOptions).limit(50).lean();

    // Transform post reaction counts and user's reacted status
    const authUser = getAuthUser(req);
    const userIdStr = authUser ? authUser.userId.toString() : null;

    const formattedPosts = posts.map(p => {
      const hearYouCount = (p.reactions?.hearYou || []).length;
      const notAloneCount = (p.reactions?.notAlone || []).length;
      const strongCount = (p.reactions?.strongForYou || []).length;
      const meTooCount = (p.reactions?.meToo || []).length;
      const totalReactions = hearYouCount + notAloneCount + strongCount + meTooCount;

      let userReactions = {
        hearYou: false,
        notAlone: false,
        strongForYou: false,
        meToo: false
      };

      if (userIdStr && p.reactions) {
        userReactions = {
          hearYou: (p.reactions.hearYou || []).some(id => id.toString() === userIdStr),
          notAlone: (p.reactions.notAlone || []).some(id => id.toString() === userIdStr),
          strongForYou: (p.reactions.strongForYou || []).some(id => id.toString() === userIdStr),
          meToo: (p.reactions.meToo || []).some(id => id.toString() === userIdStr)
        };
      }

      return {
        _id: p._id,
        authorPseudonym: p.authorPseudonym,
        authorAvatar: p.authorAvatar || '🌱',
        content: p.content,
        topic: p.topic,
        supportIntent: p.supportIntent,
        mood: p.mood,
        isAnonymous: p.isAnonymous,
        reactions: {
          hearYou: hearYouCount,
          notAlone: notAloneCount,
          strongForYou: strongCount,
          meToo: meTooCount,
          total: totalReactions
        },
        userReactions,
        commentsCount: (p.comments || []).length,
        comments: (p.comments || []).slice(-10),
        createdAt: p.createdAt
      };
    });

    res.json({ success: true, posts: formattedPosts });
  } catch (error) {
    console.error('Error fetching peer posts:', error);
    res.status(500).json({ error: 'Failed to fetch community posts' });
  }
});

// POST /api/peer/posts — create a new anonymous support post
router.post('/posts', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const { content, topic, supportIntent, mood, isAnonymous = true } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    if (content.trim().length > 3000) {
      return res.status(400).json({ error: 'Post exceeds maximum allowed length of 3000 characters' });
    }

    const pseudonym = isAnonymous ? generatePseudonym() : (authUser ? (await User.findById(authUser.userId))?.name || 'Student' : 'Anonymous Student');
    const avatar = getRandomAvatar();

    const newPost = new PeerPost({
      authorId: authUser ? authUser.userId : null,
      authorPseudonym: pseudonym,
      authorAvatar: avatar,
      content: content.trim(),
      topic: topic || 'General',
      supportIntent: supportIntent || 'I need someone to listen',
      mood: mood || 'Unspecified',
      isAnonymous: Boolean(isAnonymous)
    });

    await newPost.save();

    res.status(201).json({
      success: true,
      message: 'Support post published successfully!',
      post: newPost
    });
  } catch (error) {
    console.error('Error creating peer post:', error);
    res.status(500).json({ error: 'Failed to publish post' });
  }
});

// POST /api/peer/posts/:id/react — toggle a supportive reaction
router.post('/posts/:id/react', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const { reactionType = 'notAlone' } = req.body;
    const validReactions = ['hearYou', 'notAlone', 'strongForYou', 'meToo'];

    if (!validReactions.includes(reactionType)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const post = await PeerPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (!post.reactions) {
      post.reactions = { hearYou: [], notAlone: [], strongForYou: [], meToo: [] };
    }

    // If user is authenticated, use their real userId; otherwise use a session/dummy ID
    const userId = authUser ? authUser.userId : null;

    if (userId) {
      const arr = post.reactions[reactionType] || [];
      const existingIdx = arr.findIndex(id => id && id.toString() === userId.toString());
      if (existingIdx > -1) {
        arr.splice(existingIdx, 1); // unreact
      } else {
        arr.push(userId); // react
      }
      post.reactions[reactionType] = arr;
    } else {
      // Guest: toggle reaction in memory or add dummy entry
      post.reactions[reactionType].push(new mongoose.Types.ObjectId());
    }

    await post.save();

    const hearYouCount = (post.reactions.hearYou || []).length;
    const notAloneCount = (post.reactions.notAlone || []).length;
    const strongCount = (post.reactions.strongForYou || []).length;
    const meTooCount = (post.reactions.meToo || []).length;

    res.json({
      success: true,
      reactions: {
        hearYou: hearYouCount,
        notAlone: notAloneCount,
        strongForYou: strongCount,
        meToo: meTooCount,
        total: hearYouCount + notAloneCount + strongCount + meTooCount
      }
    });
  } catch (error) {
    console.error('Error reacting to post:', error);
    res.status(500).json({ error: 'Failed to record reaction' });
  }
});

// POST /api/peer/posts/:id/comment — add supportive comment
router.post('/posts/:id/comment', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const { content, isAnonymous = true } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const post = await PeerPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    let pseudonym = generatePseudonym();
    if (!isAnonymous && authUser) {
      const u = await User.findById(authUser.userId);
      if (u) pseudonym = u.name;
    }

    const newComment = {
      authorId: authUser ? authUser.userId : null,
      authorPseudonym: pseudonym,
      content: content.trim(),
      isAnonymous: Boolean(isAnonymous),
      createdAt: new Date()
    };

    post.comments.push(newComment);
    await post.save();

    res.status(201).json({
      success: true,
      message: 'Supportive comment added!',
      comment: newComment,
      commentsCount: post.comments.length
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// POST /api/peer/posts/:id/report — report post for moderation
router.post('/posts/:id/report', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const { reason = 'Inappropriate content' } = req.body;

    const post = await PeerPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.reports.push({
      reportedBy: authUser ? authUser.userId : null,
      reason: reason.trim(),
      createdAt: new Date()
    });

    if (post.reports.length >= 3) {
      post.isFlagged = true; // Auto-hide after 3 reports
    }

    await post.save();

    res.json({
      success: true,
      message: 'Thank you for helping keep our peer community safe. This post has been submitted to human moderators.'
    });
  } catch (error) {
    console.error('Error reporting post:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// ---------------------------------------------------------------------------
// 2. FIND A PEER BUDDY ENDPOINTS
// ---------------------------------------------------------------------------

// GET /api/peer/buddy/profile — get user's buddy profile
router.get('/buddy/profile', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Please log in to manage your Peer Buddy profile' });
    }

    let profile = await PeerBuddyProfile.findOne({ userId: authUser.userId });
    res.json({ success: true, profile: profile || null });
  } catch (error) {
    console.error('Error getting buddy profile:', error);
    res.status(500).json({ error: 'Failed to fetch buddy profile' });
  }
});

// POST /api/peer/buddy/profile — save or update buddy profile
router.post('/buddy/profile', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Please log in to create your Peer Buddy profile' });
    }

    const {
      collegeYear = '1st Year',
      preferredLanguage = 'English',
      interests = [],
      availability = 'Flexible',
      supportGoal = 'Making friends',
      bio = '',
      isAvailable = true
    } = req.body;

    const userDoc = await User.findById(authUser.userId);
    const defaultPseudonym = userDoc ? `Buddy (${userDoc.name.split(' ')[0]})` : generatePseudonym();

    let profile = await PeerBuddyProfile.findOne({ userId: authUser.userId });
    if (!profile) {
      profile = new PeerBuddyProfile({
        userId: authUser.userId,
        pseudonym: defaultPseudonym,
        collegeYear,
        preferredLanguage,
        interests: Array.isArray(interests) ? interests : [],
        availability,
        supportGoal,
        bio: bio.trim(),
        isAvailable: Boolean(isAvailable)
      });
    } else {
      profile.collegeYear = collegeYear;
      profile.preferredLanguage = preferredLanguage;
      profile.interests = Array.isArray(interests) ? interests : profile.interests;
      profile.availability = availability;
      profile.supportGoal = supportGoal;
      profile.bio = bio.trim();
      profile.isAvailable = Boolean(isAvailable);
      profile.updatedAt = new Date();
    }

    await profile.save();
    res.json({ success: true, message: 'Buddy profile saved successfully!', profile });
  } catch (error) {
    console.error('Error saving buddy profile:', error);
    res.status(500).json({ error: 'Failed to save buddy profile' });
  }
});

// GET /api/peer/buddy/active-match — get current active match
router.get('/buddy/active-match', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const activeMatch = await PeerBuddyMatch.findOne({
      status: 'active',
      $or: [{ studentA: authUser.userId }, { studentB: authUser.userId }]
    }).lean();

    if (!activeMatch) {
      return res.json({ success: true, match: null });
    }

    // Determine buddy's pseudonym for current user
    const isStudentA = activeMatch.studentA.toString() === authUser.userId.toString();
    const otherStudentId = isStudentA ? activeMatch.studentB : activeMatch.studentA;
    const buddyPseudonym = isStudentA ? activeMatch.pseudonymB : activeMatch.pseudonymA;

    // Get buddy's profile metadata (interests, year)
    const otherProfile = await PeerBuddyProfile.findOne({ userId: otherStudentId }).select('collegeYear preferredLanguage interests supportGoal availability bio').lean();

    res.json({
      success: true,
      match: {
        _id: activeMatch._id,
        buddyPseudonym,
        sharedGoal: activeMatch.sharedGoal,
        matchedAt: activeMatch.matchedAt,
        buddyDetails: otherProfile || {
          collegeYear: 'Peer Student',
          preferredLanguage: 'English',
          interests: ['Mutual Support'],
          supportGoal: activeMatch.sharedGoal
        },
        messages: activeMatch.messages || []
      }
    });
  } catch (error) {
    console.error('Error getting active match:', error);
    res.status(500).json({ error: 'Failed to retrieve active buddy match' });
  }
});

// POST /api/peer/buddy/find — find & match with a peer buddy
router.post('/buddy/find', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Please log in to find a peer buddy' });
    }

    // Check if user already has an active match
    let currentMatch = await PeerBuddyMatch.findOne({
      status: 'active',
      $or: [{ studentA: authUser.userId }, { studentB: authUser.userId }]
    });

    if (currentMatch) {
      return res.json({
        success: true,
        alreadyMatched: true,
        message: 'You already have an active peer buddy match!',
        match: currentMatch
      });
    }

    // Ensure user has a profile
    let myProfile = await PeerBuddyProfile.findOne({ userId: authUser.userId });
    if (!myProfile) {
      // Auto-create a starter profile from user record
      const u = await User.findById(authUser.userId);
      myProfile = new PeerBuddyProfile({
        userId: authUser.userId,
        pseudonym: u ? `Student ${u.name.split(' ')[0]}` : generatePseudonym(),
        collegeYear: '1st Year',
        interests: ['Managing academic stress', 'Study support'],
        preferredLanguage: 'English',
        supportGoal: 'Making friends'
      });
      await myProfile.save();
    }

    // Find candidates who are available, not current user, and not in an active match
    const activeMatchPairs = await PeerBuddyMatch.find({ status: 'active' }).select('studentA studentB');
    const matchedUserIds = new Set();
    activeMatchPairs.forEach(m => {
      matchedUserIds.add(m.studentA.toString());
      matchedUserIds.add(m.studentB.toString());
    });
    matchedUserIds.add(authUser.userId.toString());

    const candidates = await PeerBuddyProfile.find({
      isAvailable: true,
      userId: { $nin: Array.from(matchedUserIds) }
    }).lean();

    let bestCandidate = null;
    let highestScore = -1;

    for (const cand of candidates) {
      let score = 0;
      // Goal match (weight: 4)
      if (cand.supportGoal === myProfile.supportGoal) score += 4;
      // Language match (weight: 3)
      if (cand.preferredLanguage === myProfile.preferredLanguage) score += 3;
      // Shared interests (weight: 2 per interest)
      const myInterests = myProfile.interests || [];
      const candInterests = cand.interests || [];
      const sharedInterests = myInterests.filter(i => candInterests.includes(i));
      score += sharedInterests.length * 2;
      // Availability match (weight: 2)
      if (cand.availability === myProfile.availability) score += 2;

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = cand;
      }
    }

    // If no candidate exists in the database, match with a friendly peer volunteer or simulated buddy
    if (!bestCandidate) {
      // Create a virtual peer companion for instant connection so the student is never left hanging
      const virtualBuddy = {
        pseudonym: 'Senior Buddy Alex',
        collegeYear: '2nd Year Mentor',
        preferredLanguage: myProfile.preferredLanguage || 'English',
        interests: myProfile.interests && myProfile.interests.length ? myProfile.interests : ['Study techniques', 'Campus life'],
        supportGoal: myProfile.supportGoal || 'Managing academic stress'
      };

      const newMatch = new PeerBuddyMatch({
        studentA: authUser.userId,
        studentB: authUser.userId, // companion fallback
        pseudonymA: myProfile.pseudonym || 'You',
        pseudonymB: virtualBuddy.pseudonym,
        sharedGoal: myProfile.supportGoal,
        status: 'active',
        messages: [
          {
            senderId: authUser.userId,
            senderPseudonym: virtualBuddy.pseudonym,
            text: `Hi there! 👋 I'm ${virtualBuddy.pseudonym}. I saw that you're focusing on "${myProfile.supportGoal}". College can definitely feel overwhelming at times, but we’re in this together. How has your week been going so far?`,
            createdAt: new Date()
          }
        ]
      });

      await newMatch.save();

      return res.status(201).json({
        success: true,
        matched: true,
        message: 'Matched with a campus peer buddy!',
        match: {
          _id: newMatch._id,
          buddyPseudonym: virtualBuddy.pseudonym,
          sharedGoal: newMatch.sharedGoal,
          matchedAt: newMatch.matchedAt,
          buddyDetails: virtualBuddy,
          messages: newMatch.messages
        }
      });
    }

    // Real candidate match
    const newMatch = new PeerBuddyMatch({
      studentA: authUser.userId,
      studentB: bestCandidate.userId,
      pseudonymA: myProfile.pseudonym || 'Buddy A',
      pseudonymB: bestCandidate.pseudonym || 'Buddy B',
      sharedGoal: myProfile.supportGoal,
      status: 'active',
      messages: [
        {
          senderId: bestCandidate.userId,
          senderPseudonym: bestCandidate.pseudonym,
          text: `Hey! Excited to connect as peer buddies. Looking forward to supporting each other with ${myProfile.supportGoal}! 🌟`,
          createdAt: new Date()
        }
      ]
    });

    await newMatch.save();

    res.status(201).json({
      success: true,
      matched: true,
      message: 'Matched with a peer buddy!',
      match: {
        _id: newMatch._id,
        buddyPseudonym: bestCandidate.pseudonym,
        sharedGoal: newMatch.sharedGoal,
        matchedAt: newMatch.matchedAt,
        buddyDetails: bestCandidate,
        messages: newMatch.messages
      }
    });
  } catch (error) {
    console.error('Error finding buddy:', error);
    res.status(500).json({ error: 'Failed to complete peer buddy matching' });
  }
});

// POST /api/peer/buddy/message — send check-in message to buddy
router.post('/buddy/message', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { matchId, text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const match = await PeerBuddyMatch.findById(matchId);
    if (!match || match.status !== 'active') {
      return res.status(404).json({ error: 'Active buddy match not found' });
    }

    const isStudentA = match.studentA.toString() === authUser.userId.toString();
    const senderPseudonym = isStudentA ? match.pseudonymA : match.pseudonymB;

    const messageObj = {
      senderId: authUser.userId,
      senderPseudonym,
      text: text.trim(),
      createdAt: new Date()
    };

    match.messages.push(messageObj);

    // If it's a simulated companion match, generate a supportive response after 1s
    if (match.studentA.toString() === match.studentB.toString()) {
      const buddyReplies = [
        "That totally makes sense. Thank you for sharing that with me. Remember to take things one day at a time!",
        "I hear you! I went through a very similar phase last semester. Don't forget to take small breaks for yourself today.",
        "That sounds like a solid step forward. Celebrating that with you! 🎉 Keep me posted on how it turns out.",
        "I appreciate you checking in. Make sure you hydrate and get some solid rest tonight — you've got this!"
      ];
      const replyText = buddyReplies[Math.floor(Math.random() * buddyReplies.length)];
      setTimeout(async () => {
        try {
          const freshMatch = await PeerBuddyMatch.findById(matchId);
          if (freshMatch && freshMatch.status === 'active') {
            freshMatch.messages.push({
              senderId: authUser.userId,
              senderPseudonym: match.pseudonymB,
              text: replyText,
              createdAt: new Date()
            });
            await freshMatch.save();
          }
        } catch (e) {
          console.error('Auto buddy reply error:', e);
        }
      }, 1000);
    }

    await match.save();

    res.status(201).json({
      success: true,
      message: messageObj
    });
  } catch (error) {
    console.error('Error sending buddy message:', error);
    res.status(500).json({ error: 'Failed to send check-in message' });
  }
});

// POST /api/peer/buddy/end-match — end active match respectfully
router.post('/buddy/end-match', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { matchId, reason = 'Goal accomplished / friendly closure' } = req.body;
    const match = await PeerBuddyMatch.findById(matchId);

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    match.status = 'ended';
    match.endedBy = authUser.userId;
    match.endReason = reason;
    await match.save();

    res.json({
      success: true,
      message: 'Buddy match has been ended respectfully. You can match again whenever you are ready.'
    });
  } catch (error) {
    console.error('Error ending match:', error);
    res.status(500).json({ error: 'Failed to end buddy match' });
  }
});

// POST /api/peer/buddy/report — report inappropriate buddy behavior
router.post('/buddy/report', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const { matchId, reason } = req.body;

    const match = await PeerBuddyMatch.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    match.reports.push({
      reportedBy: authUser ? authUser.userId : null,
      reason: reason || 'Inappropriate conduct',
      createdAt: new Date()
    });
    match.status = 'ended'; // Immediately disconnect upon safety report
    await match.save();

    res.json({
      success: true,
      message: 'Report submitted. The match has been safely disconnected and our safety team has been alerted.'
    });
  } catch (error) {
    console.error('Error reporting buddy:', error);
    res.status(500).json({ error: 'Failed to report buddy' });
  }
});

// ---------------------------------------------------------------------------
// 3. PEER SUPPORT CIRCLES ENDPOINTS
// ---------------------------------------------------------------------------

// GET /api/peer/circles — list all support circles
router.get('/circles', async (req, res) => {
  try {
    await ensureSeedData();
    const circles = await PeerCircle.find().sort({ memberCount: -1 }).lean();
    const authUser = getAuthUser(req);
    const userIdStr = authUser ? authUser.userId.toString() : null;

    const formatted = circles.map(c => {
      const isMember = userIdStr ? (c.members || []).some(m => m.toString() === userIdStr) : false;
      return {
        _id: c._id,
        circleId: c.circleId,
        name: c.name,
        tagline: c.tagline,
        description: c.description,
        icon: c.icon,
        category: c.category,
        schedule: c.schedule,
        meetingTime: c.meetingTime,
        memberCount: (c.members || []).length || c.memberCount || 20,
        isMember,
        recentMessages: (c.messages || []).slice(-3)
      };
    });

    res.json({ success: true, circles: formatted });
  } catch (error) {
    console.error('Error getting circles:', error);
    res.status(500).json({ error: 'Failed to fetch circles' });
  }
});

// POST /api/peer/circles/:circleId/join — toggle join/leave circle
router.post('/circles/:circleId/join', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Please log in to join peer support circles' });
    }

    const circle = await PeerCircle.findOne({ circleId: req.params.circleId });
    if (!circle) {
      return res.status(404).json({ error: 'Support circle not found' });
    }

    const userIdStr = authUser.userId.toString();
    const existingIdx = (circle.members || []).findIndex(m => m && m.toString() === userIdStr);

    let joined = false;
    if (existingIdx > -1) {
      circle.members.splice(existingIdx, 1);
      circle.memberCount = Math.max(0, (circle.memberCount || 1) - 1);
      joined = false;
    } else {
      circle.members.push(authUser.userId);
      circle.memberCount = (circle.memberCount || 0) + 1;
      joined = true;
    }

    await circle.save();

    res.json({
      success: true,
      joined,
      memberCount: circle.memberCount,
      message: joined ? `Joined ${circle.name}!` : `Left ${circle.name}.`
    });
  } catch (error) {
    console.error('Error joining circle:', error);
    res.status(500).json({ error: 'Failed to update circle membership' });
  }
});

// GET /api/peer/circles/:circleId/messages — get discussion messages
router.get('/circles/:circleId/messages', async (req, res) => {
  try {
    const circle = await PeerCircle.findOne({ circleId: req.params.circleId }).lean();
    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    res.json({
      success: true,
      circleName: circle.name,
      messages: circle.messages || []
    });
  } catch (error) {
    console.error('Error fetching circle messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/peer/circles/:circleId/messages — post message to circle
router.post('/circles/:circleId/messages', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const { content, isAnonymous = true } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const circle = await PeerCircle.findOne({ circleId: req.params.circleId });
    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    let pseudonym = generatePseudonym();
    if (!isAnonymous && authUser) {
      const u = await User.findById(authUser.userId);
      if (u) pseudonym = u.name;
    }

    const msg = {
      authorId: authUser ? authUser.userId : null,
      authorPseudonym: pseudonym,
      authorAvatar: getRandomAvatar(),
      content: content.trim(),
      isAnonymous: Boolean(isAnonymous),
      createdAt: new Date()
    };

    circle.messages.push(msg);
    await circle.save();

    res.status(201).json({
      success: true,
      message: msg
    });
  } catch (error) {
    console.error('Error posting circle message:', error);
    res.status(500).json({ error: 'Failed to post message to circle' });
  }
});

// ---------------------------------------------------------------------------
// 4. DAILY CHECK-IN & SUPPORT REQUESTS ENDPOINTS
// ---------------------------------------------------------------------------

// POST /api/peer/checkin — record daily mood & support intent
router.post('/checkin', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const { mood, supportIntent, note = '', isShared = false, guestSessionId } = req.body;

    const validMoods = ['Good', 'Okay', 'Low', 'Anxious', 'Overwhelmed'];
    if (!mood || !validMoods.includes(mood)) {
      return res.status(400).json({ error: 'Valid mood selection is required' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const checkIn = new DailyCheckIn({
      userId: authUser ? authUser.userId : null,
      guestSessionId: guestSessionId || null,
      mood,
      supportIntent: supportIntent || 'Just tracking my mood privately',
      note: note.trim(),
      isShared: Boolean(isShared),
      dateString: todayStr
    });

    await checkIn.save();

    res.status(201).json({
      success: true,
      message: 'Check-in recorded! Thank you for honoring how you feel today.',
      checkIn
    });
  } catch (error) {
    console.error('Error saving check-in:', error);
    res.status(500).json({ error: 'Failed to save daily check-in' });
  }
});

// GET /api/peer/checkin/today — get today's checkin summary & community mood breakdown
router.get('/checkin/today', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCheckIns = await DailyCheckIn.find({ dateString: todayStr }).lean();

    const moodCounts = { Good: 0, Okay: 0, Low: 0, Anxious: 0, Overwhelmed: 0 };
    todayCheckIns.forEach(c => {
      if (moodCounts[c.mood] !== undefined) {
        moodCounts[c.mood]++;
      }
    });

    const authUser = getAuthUser(req);
    let myCheckIn = null;
    if (authUser) {
      myCheckIn = await DailyCheckIn.findOne({ userId: authUser.userId, dateString: todayStr }).sort({ createdAt: -1 });
    }

    res.json({
      success: true,
      date: todayStr,
      totalToday: todayCheckIns.length,
      communityMood: moodCounts,
      myCheckIn
    });
  } catch (error) {
    console.error('Error fetching checkin today:', error);
    res.status(500).json({ error: 'Failed to fetch check-in status' });
  }
});

// ---------------------------------------------------------------------------
// 5. KINDNESS WALL & DAILY ENCOURAGEMENT ENDPOINTS
// ---------------------------------------------------------------------------

// GET /api/peer/kindness — list kindness posts & today's question
router.get('/kindness', async (req, res) => {
  try {
    await ensureSeedData();
    const posts = await KindnessPost.find().sort({ createdAt: -1 }).limit(30).lean();

    const authUser = getAuthUser(req);
    const userIdStr = authUser ? authUser.userId.toString() : null;

    const formatted = posts.map(p => {
      const hasHearted = userIdStr ? (p.hearts || []).some(id => id.toString() === userIdStr) : false;
      return {
        _id: p._id,
        authorPseudonym: p.authorPseudonym,
        category: p.category,
        content: p.content,
        colorTheme: p.colorTheme || 'mint',
        heartsCount: (p.hearts || []).length || p.heartsCount || 0,
        hasHearted,
        createdAt: p.createdAt
      };
    });

    // Daily question that rotates
    const dailyQuestions = [
      "What is one gentle thing you did for yourself today?",
      "What is a piece of advice you’d give to a friend having a hard week?",
      "What song, place, or memory made you smile recently?",
      "What is one expectation you decided to let go of this week?",
      "Who or what are you quietly grateful for today?"
    ];
    const dayIndex = new Date().getDate() % dailyQuestions.length;
    const dailyQuestion = dailyQuestions[dayIndex];

    res.json({
      success: true,
      dailyQuestion,
      posts: formatted
    });
  } catch (error) {
    console.error('Error fetching kindness wall:', error);
    res.status(500).json({ error: 'Failed to fetch kindness posts' });
  }
});

// POST /api/peer/kindness — post a new encouragement card
router.post('/kindness', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const { category, content, colorTheme = 'mint' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const pseudonym = generatePseudonym();

    const post = new KindnessPost({
      authorId: authUser ? authUser.userId : null,
      authorPseudonym: pseudonym,
      category: category || 'One small win I had today…',
      content: content.trim(),
      colorTheme,
      heartsCount: 1,
      hearts: authUser ? [authUser.userId] : []
    });

    await post.save();

    res.status(201).json({
      success: true,
      message: 'Encouragement posted to Kindness Wall! 💛',
      post
    });
  } catch (error) {
    console.error('Error creating kindness post:', error);
    res.status(500).json({ error: 'Failed to publish to kindness wall' });
  }
});

// POST /api/peer/kindness/:id/heart — give heart encouragement
router.post('/kindness/:id/heart', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const post = await KindnessPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (authUser) {
      const idx = (post.hearts || []).findIndex(id => id && id.toString() === authUser.userId.toString());
      if (idx > -1) {
        post.hearts.splice(idx, 1);
        post.heartsCount = Math.max(0, (post.heartsCount || 1) - 1);
      } else {
        post.hearts.push(authUser.userId);
        post.heartsCount = (post.heartsCount || 0) + 1;
      }
    } else {
      post.heartsCount = (post.heartsCount || 0) + 1;
    }

    await post.save();

    res.json({
      success: true,
      heartsCount: post.heartsCount
    });
  } catch (error) {
    console.error('Error hearting post:', error);
    res.status(500).json({ error: 'Failed to record heart' });
  }
});

// ---------------------------------------------------------------------------
// 6. AI-POWERED PEER SUPPORT ASSISTANT ENDPOINTS
// ---------------------------------------------------------------------------

// POST /api/peer/ai/reply-suggestions — generate empathetic replies to make peer feel heard
router.post('/ai/reply-suggestions', async (req, res) => {
  try {
    const { postContent, topic, supportIntent } = req.body;

    if (!postContent) {
      return res.status(400).json({ error: 'Post content is required for suggestion generation' });
    }

    // High quality empathetic templates tailored to support intents
    let suggestions = [];

    if (supportIntent === 'I want to celebrate a small win') {
      suggestions = [
        "That is such a genuine win! Huge congratulations on pushing through — taking a moment to acknowledge your progress is so important. 🎉",
        "Celebrating this with you! Small steps like this compound into massive growth. Keep that momentum going!",
        "Love seeing this! You earned this win, and you should be really proud of your perseverance."
      ];
    } else if (supportIntent === 'I need someone to listen') {
      suggestions = [
        "I hear you, and your feelings are completely valid. It sounds like you are carrying a lot right now. Sending you warmth and strength.",
        "Thank you for being open and sharing this with us. You don’t have to carry this completely alone — we’re here with you.",
        "That sounds really exhausting, and it makes complete sense that you feel this way. Please remember to take a gentle breath today."
      ];
    } else if (supportIntent === 'I need advice from someone with a similar experience') {
      suggestions = [
        "I went through something very similar last semester. What helped me was breaking tasks down into tiny 15-minute chunks so my brain didn't freeze. You've got this!",
        "Totally resonated with this. What brought me peace was setting clear boundaries on my study hours — rest isn't laziness, it's brain fuel.",
        "I’ve been right in that spot. Try giving yourself permission to just do 'good enough' instead of aiming for impossible perfection today."
      ];
    } else {
      // General empathetic suggestions
      suggestions = [
        "Thank you for sharing this. Just wanted to let you know that you are heard, seen, and not alone in this.",
        "Sending you supportive thoughts today. Take things one breath and one moment at a time.",
        "Your feelings make complete sense given what you're balancing. Be extra kind to yourself tonight."
      ];
    }

    res.json({
      success: true,
      suggestions,
      guidance: 'Your response should make the student feel heard and validated.'
    });
  } catch (error) {
    console.error('Error generating AI reply ideas:', error);
    res.status(500).json({ error: 'Failed to generate empathetic suggestions' });
  }
});

// POST /api/peer/ai/recommend-resources — smart campus & coping tools recommender
router.post('/ai/recommend-resources', async (req, res) => {
  try {
    const { mood, topic, text } = req.body;

    const recommendations = {
      recommendedCircle: null,
      copingExercise: null,
      campusSupport: {
        title: 'Book a Confidential Campus Counsellor',
        link: 'book.html',
        description: 'Free, professional 1-on-1 counseling with certified campus psychologists.'
      },
      helpline: {
        name: 'National Student Mental Health Helpline (KIRAN)',
        number: '1800-599-0019',
        teleManas: '14416 (24/7 Toll-Free)'
      }
    };

    if (topic === 'Exam Stress' || mood === 'Anxious') {
      recommendations.recommendedCircle = {
        name: 'Exam Stress Club',
        circleId: 'exam-stress',
        tagline: 'Study pressure, prep fatigue & exam anxiety'
      };
      recommendations.copingExercise = {
        title: '4-7-8 Deep Box Breathing',
        description: 'Inhale for 4 seconds, hold for 7 seconds, exhale slowly for 8 seconds. Resets heart rate and nervous system.'
      };
    } else if (topic === 'Homesickness & College Life' || topic === 'Loneliness & Social') {
      recommendations.recommendedCircle = {
        name: 'New to College Circle',
        circleId: 'new-to-college',
        tagline: 'Homesickness & making campus friends'
      };
      recommendations.copingExercise = {
        title: '5-4-3-2-1 Sensory Grounding',
        description: 'Acknowledge 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste.'
      };
    } else if (topic === 'Relationships') {
      recommendations.recommendedCircle = {
        name: 'Breakup & Emotional Support',
        circleId: 'breakup-emotional',
        tagline: 'Coping with relationship changes & grief'
      };
      recommendations.copingExercise = {
        title: 'Self-Compassion Pause',
        description: 'Place a warm hand over your heart, take three deep breaths, and repeat: "This is a moment of suffering, and I am worthy of care."'
      };
    } else {
      recommendations.recommendedCircle = {
        name: 'Confidence Corner',
        circleId: 'confidence-corner',
        tagline: 'Self-esteem, imposter syndrome & social anxiety'
      };
      recommendations.copingExercise = {
        title: 'Progressive Muscle Relaxation',
        description: 'Tense your shoulders for 5 seconds, then let them drop completely. Release all held tension in the jaw and neck.'
      };
    }

    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

module.exports = router;

const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const Appointment = require('../models/Appointment');
const DailyCheckIn = require('../models/DailyCheckIn');
const { PeerBuddyProfile } = require('../models/PeerBuddy');

/**
 * Silently assembles student matching preferences from background sources
 * (AI chat history, counsellor appointment feedback, daily check-ins, and user profile)
 * without interrogating the student directly.
 * 
 * Complies with privacy & safety guardrails:
 * - Avoids matching based solely on mental health diagnosis or sensitive crisis data.
 * - Extracts only constructive peer connection signals (language, support goal, college year, interests).
 */
async function collectOrInferStudentProfile(userId) {
  if (!userId) return null;

  try {
    const user = await User.findById(userId).lean();
    if (!user) return null;

    let preferredLanguage = 'English';
    let supportGoal = 'Managing academic stress'; // default safe student goal
    let collegeYear = '1st Year';
    let interestsSet = new Set(['Study Techniques', 'Campus Life']);

    // 1. Infer College Year from Age or user profile
    const age = Number(user.age);
    if (!isNaN(age) && age > 0) {
      if (age <= 18) collegeYear = '1st Year';
      else if (age === 19) collegeYear = '2nd Year';
      else if (age === 20) collegeYear = '3rd Year';
      else collegeYear = '4th Year / Postgrad';
    }

    let aiChatAnalyzed = false;
    let counsellorFeedbackAnalyzed = false;
    let dailyCheckInAnalyzed = false;

    // 2. Silently analyze AI Chat history
    const recentChats = await ChatMessage.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    if (recentChats && recentChats.length > 0) {
      aiChatAnalyzed = true;
      const combinedText = recentChats.map(c => c.message || '').join(' ');

      // Language detection
      if (/[\u0900-\u097F]/.test(combinedText) || /\b(namaste|padhai|kare|mujhe|nahi|bhai|kaise|hota)\b/i.test(combinedText)) {
        preferredLanguage = 'Hindi';
      } else if (/[\u0980-\u09FF]/.test(combinedText)) {
        preferredLanguage = 'Bengali';
      } else if (/[\u0B80-\u0BFF]/.test(combinedText)) {
        preferredLanguage = 'Tamil';
      } else if (/[\u0C00-\u0C7F]/.test(combinedText)) {
        preferredLanguage = 'Telugu';
      }

      // Difficulty & topic counts
      let academicScore = 0;
      let socialScore = 0;
      let transitionScore = 0;
      let burnoutScore = 0;

      recentChats.forEach(c => {
        const diffs = c.detectedDifficulties || [];
        diffs.forEach(d => {
          if (d === 'Academic & Exam Stress') academicScore += 2;
          if (d === 'Loneliness & Social Isolation') socialScore += 2;
          if (d === 'Burnout & Overwhelm' || d === 'Sleep Issues & Insomnia') burnoutScore += 2;
          if (d === 'Relationship & Family Stress') transitionScore += 1;
        });

        // Keyword checks in text
        const txt = (c.message || '').toLowerCase();
        if (/\b(exam|exams|study|studying|marks|cgpa|backlog|syllabus|professor|assignment)\b/.test(txt)) academicScore++;
        if (/\b(friend|friends|lonely|alone|mess|nobody|talk|isolated)\b/.test(txt)) socialScore++;
        if (/\b(hostel|roommate|new to|homesick|home|adjusting|first year|campus)\b/.test(txt)) transitionScore++;
        if (/\b(burnout|tired|exhausted|sleep|overwhelmed|rest|break)\b/.test(txt)) burnoutScore++;

        // Interests detection
        if (/\b(code|coding|python|java|javascript|programming|tech|developer|hackathon)\b/.test(txt)) interestsSet.add('Coding');
        if (/\b(music|guitar|piano|song|songs|singing|spotify|band)\b/.test(txt)) interestsSet.add('Music');
        if (/\b(game|gaming|gamer|steam|valorant|bgmi|fifa|minecraft)\b/.test(txt)) interestsSet.add('Gaming');
        if (/\b(book|books|reading|novel|novels|author|literature)\b/.test(txt)) interestsSet.add('Reading');
        if (/\b(gym|workout|fitness|exercise|running|sports|cricket|football)\b/.test(txt)) interestsSet.add('Fitness');
        if (/\b(art|drawing|paint|painting|sketch|design|creative)\b/.test(txt)) interestsSet.add('Art & Creative');
      });

      // Highest score determines support goal (safe categorization)
      const maxScore = Math.max(academicScore, socialScore, transitionScore, burnoutScore);
      if (maxScore > 0) {
        if (maxScore === academicScore) supportGoal = 'Managing academic stress';
        else if (maxScore === socialScore) supportGoal = 'Making friends';
        else if (maxScore === transitionScore) supportGoal = 'Adjusting to college';
        else if (maxScore === burnoutScore) supportGoal = 'Staying motivated';
      }
    }

    // 3. Silently analyze Counsellor Appointments & Feedback
    const appointments = await Appointment.find({ student: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (appointments && appointments.length > 0) {
      counsellorFeedbackAnalyzed = true;
      const combinedConcerns = appointments.map(a => `${a.concern || ''} ${a.counsellorFeedback || ''} ${a.notes || ''}`).join(' ').toLowerCase();

      if (/\b(hostel|dorm|homesick|adjustment|transition|new student)\b/.test(combinedConcerns)) {
        supportGoal = 'Adjusting to college';
      } else if (/\b(exam|grades|academics|study|performance|pressure)\b/.test(combinedConcerns)) {
        supportGoal = 'Managing academic stress';
      } else if (/\b(friends|social|isolation|connecting|peers)\b/.test(combinedConcerns)) {
        supportGoal = 'Making friends';
      } else if (/\b(motivation|routine|burnout|exhaustion)\b/.test(combinedConcerns)) {
        supportGoal = 'Staying motivated';
      }
    }

    // 4. Silently check DailyCheckIn
    const latestCheckIn = await DailyCheckIn.findOne({ userId }).sort({ createdAt: -1 }).lean();
    if (latestCheckIn) {
      dailyCheckInAnalyzed = true;
      const intent = latestCheckIn.supportIntent || '';
      if (intent.includes('advice from someone with a similar experience')) {
        supportGoal = 'Managing academic stress';
      } else if (intent.includes('feel connected')) {
        supportGoal = 'Making friends';
      } else if (intent.includes('celebrate a small win')) {
        supportGoal = 'Staying motivated';
      }
    }

    // Ensure at least 2 interests
    if (interestsSet.size < 2) {
      interestsSet.add('Study Techniques');
      interestsSet.add('Campus Life');
    }

    const interestsArray = Array.from(interestsSet).slice(0, 5);
    const pseudonym = user.name ? `Buddy (${user.name.split(' ')[0]})` : 'Peer Buddy';

    // 5. Upsert into PeerBuddyProfile
    let profile = await PeerBuddyProfile.findOne({ userId });
    if (!profile) {
      profile = new PeerBuddyProfile({
        userId,
        pseudonym,
        collegeYear,
        preferredLanguage,
        interests: interestsArray,
        supportGoal,
        isAvailable: true,
        isOnline: true,
        lastSeen: new Date(),
        inferredFrom: {
          source: 'auto_collected',
          aiChat: aiChatAnalyzed,
          counsellorFeedback: counsellorFeedbackAnalyzed,
          dailyCheckIn: dailyCheckInAnalyzed,
          lastAnalyzed: new Date()
        }
      });
    } else {
      profile.pseudonym = pseudonym;
      profile.collegeYear = collegeYear;
      profile.preferredLanguage = preferredLanguage;
      profile.interests = interestsArray;
      profile.supportGoal = supportGoal;
      profile.isOnline = true;
      profile.lastSeen = new Date();
      profile.inferredFrom = {
        source: 'auto_collected',
        aiChat: aiChatAnalyzed,
        counsellorFeedback: counsellorFeedbackAnalyzed,
        dailyCheckIn: dailyCheckInAnalyzed,
        lastAnalyzed: new Date()
      };
      profile.updatedAt = new Date();
    }

    await profile.save();
    return profile;
  } catch (error) {
    console.error('Error in collectOrInferStudentProfile:', error);
    return null;
  }
}

/**
 * Calculates matching compatibility score between two students
 * Rules requested:
 * - Same primary support goal: HIGH PRIORITY (+50)
 * - Same preferred language: HIGH PRIORITY (+40) - language takes priority over college year or hobbies
 * - Shared interests: higher score for more shared interests (+10 each)
 * - Compatible college year: optional bonus (+5 for same, +3 for adjacent)
 * - Never matches solely on sensitive psychiatric condition
 */
function calculateCompatibilityScore(profileA, profileB) {
  let score = 0;

  // 1. Language compatibility (High priority)
  const langA = (profileA.preferredLanguage || 'English').toLowerCase();
  const langB = (profileB.preferredLanguage || 'English').toLowerCase();

  if (langA === langB) {
    score += 40; // Direct native language match
  } else if (langA === 'english' || langB === 'english') {
    score += 20; // Common shared English
  } else {
    // Incompatible language barrier
    return -100;
  }

  // 2. Primary Support Goal (High priority)
  if (profileA.supportGoal === profileB.supportGoal) {
    score += 50;
  } else {
    // Partially complementary goals
    const complementary = [
      ['Making friends', 'Adjusting to college'],
      ['Managing academic stress', 'Staying motivated'],
      ['General peer support', 'Making friends']
    ];
    const isComplementary = complementary.some(
      pair => (pair[0] === profileA.supportGoal && pair[1] === profileB.supportGoal) ||
              (pair[1] === profileA.supportGoal && pair[0] === profileB.supportGoal)
    );
    if (isComplementary) {
      score += 25;
    } else {
      score += 10;
    }
  }

  // 3. Shared Interests (+10 for each shared interest)
  const interestsA = profileA.interests || [];
  const interestsB = profileB.interests || [];
  const shared = interestsA.filter(i => interestsB.includes(i));
  score += shared.length * 10;

  // 4. Compatible College Year (Optional bonus: +5)
  if (profileA.collegeYear === profileB.collegeYear) {
    score += 5;
  } else {
    const yearOrder = { '1st Year': 1, '2nd Year': 2, '3rd Year': 3, '4th Year / Postgrad': 4 };
    const numA = yearOrder[profileA.collegeYear] || 1;
    const numB = yearOrder[profileB.collegeYear] || 1;
    if (Math.abs(numA - numB) === 1) {
      score += 3; // Adjacent year
    }
  }

  return score;
}

module.exports = {
  collectOrInferStudentProfile,
  calculateCompatibilityScore
};

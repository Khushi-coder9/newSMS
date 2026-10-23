/**
 * Difficulty & Keyword Analyzer for Student Mind Support
 * Analyzes student chat messages to detect difficulty categories, positive recovery shifts, and key phrases.
 * Includes negation detection to prevent false crisis/burnout flags on recovery expressions.
 */

const DIFFICULTY_DEFINITIONS = [
  {
    category: 'Crisis & Self-Harm',
    severity: 'crisis',
    keywords: [
      'suicide', 'sucide', 'suicidal', 'kill', 'kill myself', 'killing myself', 'kill me', 'want to kill',
      'self-destruction', 'self destruction', 'self-destructive', 'self destructive',
      'self-murder', 'self murder',
      'self-slaughter', 'self slaughter',
      'self-annihilation', 'self annihilation',
      'felo-de-se', 'felo de se',
      'end my life', 'want to die', 'wanna die',
      'self harm', 'self-harm', 'cut myself', 'harming myself', 'no reason to live',
      'better off dead', 'hang myself', 'overdose', 'hurt myself', 'end it all',
      'खुदकुशी', 'आत्महत्या', 'मरने का मन'
    ]
  },
  {
    category: 'Positive Recovery & Resilience',
    severity: 'normal',
    isPositive: true,
    keywords: [
      'calm', 'peaceful', 'relaxed', 'at ease', 'feeling calm', 'much better',
      'feeling better', 'feeling good', 'feeling great', 'doing well', 'doing great',
      'doing much better', 'feeling happy', 'happy now', 'relieved', 'relief',
      'sense of relief', 'breathing easier', 'content', 'peace of mind',
      'peaceful mind', 'hopeful', 'optimistic', 'unstressed', 'refreshed',
      'feeling safe', 'balanced', 'clear mind', 'lighthearted', 'healing',
      'recovered', 'recovering', 'improving', 'stronger now', 'in control',
      'made progress', 'feeling grateful', 'gratitude', 'thank you', 'no worries',
      'all good', 'everything is good', 'life is good', 'good now', 'better now',
      'peace', 'serene', 'grounded', 'uplifted', 'cheerful', 'confident',
      'अच्छा लग रहा', 'शांत', 'बेहतर', 'सुधार', 'खुश', 'सब ठीक है', 'सुकून', 'राहत'
    ]
  },
  {
    category: 'Academic & Exam Stress',
    severity: 'moderate',
    keywords: [
      'exam', 'exams', 'study', 'studying', 'studies', 'syllabus', 'marks', 'grades',
      'gpa', 'cgpa', 'score', 'scores', 'assignment', 'assignments', 'homework',
      'project', 'deadline', 'deadlines', 'fail', 'failing', 'failure', 'failed',
      'backlog', 'backlogs', 'semester', 'sem', 'test', 'tests', 'quiz', 'professor',
      'teacher', 'attendance', 'placement', 'placements', 'interview', 'revision',
      'internship', 'class', 'lecture', 'neet', 'jee', 'gate', 'cat exam',
      'परीक्षा', 'पढ़ाई', 'मार्क्स', 'नंबर', 'फेल', 'सिलेबस'
    ]
  },
  {
    category: 'Anxiety & Panic',
    severity: 'moderate',
    keywords: [
      'anxiety', 'anxious', 'panic', 'panic attack', 'nervous', 'nervousness',
      'scared', 'fear', 'frightened', 'heart racing', 'shaking', 'trembling',
      'chest tight', 'tightness in chest', 'hyperventilating', 'breathless',
      'short of breath', 'worry', 'worried', 'worrying', 'overthinking', 'overthink',
      'restless', 'restlessness', 'dread', 'phobia', 'sweating', 'palpitations',
      'tense', 'choking feeling', 'घबराहट', 'चिंता', 'बेचैनी', 'डर'
    ]
  },
  {
    category: 'Depression & Low Mood',
    severity: 'moderate',
    keywords: [
      'depressed', 'depression', 'sad', 'sadness', 'crying', 'cry', 'cried',
      'hopeless', 'hopelessness', 'worthless', 'unhappy', 'empty', 'emptiness',
      'numb', 'no motivation', 'unmotivated', 'hate myself', 'giving up',
      'miserable', 'dark thoughts', "can't do this anymore", 'heavy heart',
      'feeling down', 'low mood', 'no energy', 'crying all day',
      'उदास', 'उदासी', 'निराश', 'रोना', 'अकेलापन'
    ]
  },
  {
    category: 'Sleep Issues & Insomnia',
    severity: 'moderate',
    keywords: [
      'sleep', 'insomnia', 'sleepless', "can't sleep", 'cannot sleep', 'cant sleep',
      'nightmare', 'nightmares', 'waking up', 'tired', 'exhausted', 'exhaustion',
      'fatigue', 'sleep schedule', 'oversleeping', 'drowsy', 'restless night',
      'awake all night', 'trouble sleeping', 'neend', 'नींद', 'अनिद्रा'
    ]
  },
  {
    category: 'Loneliness & Social Isolation',
    severity: 'moderate',
    keywords: [
      'lonely', 'loneliness', 'alone', 'isolated', 'isolation', 'no friends',
      'left out', 'homesick', 'homesickness', 'nobody cares', 'no one cares',
      'nobody to talk to', 'alienated', 'social anxiety', 'peer pressure',
      'introvert', 'feeling rejected', 'exclusion', 'feeling invisible',
      'अकेला', 'अकेलापन', 'दोस्त नहीं'
    ]
  },
  {
    category: 'Relationship & Family Stress',
    severity: 'moderate',
    keywords: [
      'breakup', 'break up', 'broken heart', 'relationship', 'partner',
      'boyfriend', 'girlfriend', 'ex', 'parents', 'family', 'fighting',
      'argument', 'arguments', 'divorce', 'toxic parents', 'strict parents',
      'family pressure', 'parental expectations', 'fight with friend',
      'betrayal', 'cheated', 'झगड़ा', 'परिवार'
    ]
  },
  {
    category: 'Burnout & Overwhelm',
    severity: 'moderate',
    keywords: [
      'burnout', 'burned out', 'burnt out', 'overwhelmed', 'overwhelming',
      'mental exhaustion', 'breakdown', 'too much pressure', "can't handle",
      'cannot handle', 'cant handle', 'stressed', 'stress', 'mental load',
      'stretched too thin', 'tension', 'stressful'
    ]
  }
];

/**
 * Escapes regex special characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a matched keyword position in text is negated
 * Looks back up to 60 characters for negation words in English and Hindi
 */
function isKeywordNegated(text, matchIndex) {
  const windowStart = Math.max(0, matchIndex - 50);
  const precedingText = text.substring(windowStart, matchIndex);

  // English negation within current clause:
  // "don't get so much", "not feeling", "no longer", "stopped having", "never", "without", etc.
  const englishNegationPattern = /\b(?:don'?t|do\s+not|doesn'?t|does\s+not|didn'?t|did\s+not|not|no\s+longer|no\s+more|never|hardly|barely|scarcely|stopped|overcame|free\s+from|without|won'?t|wont|zero|no)\b[^.!?,;\n]{0,35}$/i;

  if (englishNegationPattern.test(precedingText)) {
    return true;
  }

  // Past/historical framing before distress word (e.g., "used to be suicidal", "was stressed in the past")
  const pastFramingPattern = /\b(?:used\s+to\s+be|was|were|previously|in\s+the\s+past)\b[^.!?,;\n]{0,35}$/i;
  if (pastFramingPattern.test(precedingText)) {
    return true;
  }

  // Hindi / Hinglish preceding negation: "koi ... nahi", "tension nahi"
  const hindiPreceding = /\b(?:nahi|nahin|nhi|mat|bina)\b[^.!?,;\n]{0,25}$/i;
  if (hindiPreceding.test(precedingText)) {
    return true;
  }

  // Hindi following negation within 25 chars (e.g. "stress nahi hai", "suicidal thoughts nahi aate")
  const followingWindow = text.substring(matchIndex).slice(0, 30);
  const hindiFollowing = /^[a-z0-9\s]{0,20}\b(nahi|nahin|nhi|khatam|gayab)\b/i;
  if (hindiFollowing.test(followingWindow)) {
    return true;
  }

  return false;
}

/**
 * Analyzes a text message for difficulties, recovery indicators, and keywords.
 * Takes negation into account so "don't get stressed" is recognized as positive recovery.
 * @param {string} text - Message text to analyze
 * @returns {Object} Analysis result containing detected difficulties, keywords, severity, and positive shift flag
 */
function analyzeMessage(text) {
  if (!text || typeof text !== 'string') {
    return {
      detectedKeywords: [],
      detectedDifficulties: [],
      difficultyScores: {},
      severity: 'normal',
      primaryDifficulty: null,
      isPositiveShift: false,
      recoveryScore: 0
    };
  }

  const normalizedText = text.toLowerCase();
  const detectedKeywords = new Set();
  const detectedDifficulties = new Set();
  const difficultyScores = {};
  let highestSeverity = 'normal';
  let isPositiveShift = false;
  let recoveryScore = 0;

  for (const def of DIFFICULTY_DEFINITIONS) {
    let matchCount = 0;

    for (const keyword of def.keywords) {
      const escapedKeyword = escapeRegex(keyword);
      const isMultiWord = keyword.includes(' ');
      const isAsciiWord = /^[a-z0-9]+$/i.test(keyword);

      let isMatch = false;
      let matchIndex = -1;

      if (isAsciiWord && !isMultiWord) {
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        const match = regex.exec(normalizedText);
        if (match) {
          isMatch = true;
          matchIndex = match.index;
        }
      } else {
        matchIndex = normalizedText.indexOf(keyword.toLowerCase());
        isMatch = matchIndex !== -1;
      }

      if (isMatch) {
        // Check if keyword is negated (e.g. "don't get stressed", "no longer suicidal", "not anxious")
        const negated = isKeywordNegated(normalizedText, matchIndex);

        if (negated) {
          // Negated negative emotion is a strong indicator of recovery/relief!
          isPositiveShift = true;
          recoveryScore += 2;
          detectedDifficulties.add('Positive Recovery & Resilience');
          if (def.category === 'Crisis & Self-Harm') {
            detectedKeywords.add('relieved');
          } else {
            detectedKeywords.add('unstressed');
          }
          // Do NOT add to distress category or count toward negative severity
        } else {
          // Unnegated match
          if (def.isPositive) {
            isPositiveShift = true;
            recoveryScore += 1;
            detectedKeywords.add(keyword);
            matchCount++;
          } else {
            detectedKeywords.add(keyword);
            matchCount++;
          }
        }
      }
    }

    if (matchCount > 0) {
      detectedDifficulties.add(def.category);
      difficultyScores[def.category] = matchCount;

      if (def.severity === 'crisis') {
        highestSeverity = 'crisis';
      } else if (highestSeverity !== 'crisis' && def.severity === 'moderate') {
        highestSeverity = 'moderate';
      }
    }
  }

  // If positive recovery was detected via negated distress or positive keywords
  if (isPositiveShift && !difficultyScores['Positive Recovery & Resilience']) {
    difficultyScores['Positive Recovery & Resilience'] = recoveryScore;
  }

  const difficultiesArray = Array.from(detectedDifficulties);
  const keywordsArray = Array.from(detectedKeywords);

  // Determine primary difficulty based on highest match count
  let primaryDifficulty = null;
  let maxScore = 0;
  for (const [category, score] of Object.entries(difficultyScores)) {
    if (score > maxScore) {
      maxScore = score;
      primaryDifficulty = category;
    }
  }

  // If primary difficulty is positive recovery or no severe difficulties found
  if (isPositiveShift && (!primaryDifficulty || highestSeverity === 'normal')) {
    primaryDifficulty = 'Positive Recovery & Resilience';
  }

  return {
    detectedKeywords: keywordsArray,
    detectedDifficulties: difficultiesArray,
    difficultyScores,
    severity: highestSeverity,
    primaryDifficulty,
    isPositiveShift,
    recoveryScore
  };
}

/**
 * Helper to check if a message has severe unnegated crisis keywords
 */
function isSevereCrisis(text) {
  if (!text || typeof text !== 'string') return false;
  const analysis = analyzeMessage(text);
  return analysis.severity === 'crisis';
}

/**
 * Sanitizes keyword arrays so alarming suicide/crisis words are never displayed
 * on a student's public or personal wellness dashboard.
 */
function sanitizeKeywords(keywords = []) {
  const crisisWordsToFilter = new Set([
    'kill', 'killmyself', 'kill myself', 'killing myself', 'suicide', 'sucide',
    'suicidal', 'kill me', 'want to kill', 'self-destruction', 'self destruction',
    'die', 'want to die', 'wanna die', 'overdose', 'hang myself', 'end my life',
    'cut myself', 'harming myself', 'no reason to live'
  ]);

  const sanitized = [];
  keywords.forEach(kw => {
    if (!kw) return;
    const cleanKw = kw.toLowerCase().trim();
    if (!crisisWordsToFilter.has(cleanKw)) {
      sanitized.push(cleanKw);
    }
  });

  // Ensure healthy grounding keywords are always present
  const defaultHealthyTags = ['calm', 'relieved', 'resilience', 'mindfulness', 'balance', 'recovery'];
  for (const tag of defaultHealthyTags) {
    if (!sanitized.includes(tag) && sanitized.length < 6) {
      sanitized.push(tag);
    }
  }

  return sanitized;
}

module.exports = {
  DIFFICULTY_DEFINITIONS,
  analyzeMessage,
  isSevereCrisis,
  sanitizeKeywords
};

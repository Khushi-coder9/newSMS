/**
 * Difficulty & Keyword Analyzer for Student Mind Support
 * Analyzes student chat messages to detect difficulty categories and key phrases.
 */

const DIFFICULTY_DEFINITIONS = [
  {
    category: 'Crisis & Self-Harm',
    severity: 'crisis',
    keywords: [
      'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'wanna die',
      'self harm', 'self-harm', 'cut myself', 'harming myself', 'no reason to live',
      'better off dead', 'hang myself', 'overdose', 'hurt myself', 'end it all',
      'खुदकुशी', 'आत्महत्या', 'मरने का मन'
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
 * Analyzes a text message for difficulties and keywords
 * @param {string} text - Message text to analyze
 * @returns {Object} Analysis result containing detected difficulties, keywords, and severity
 */
function analyzeMessage(text) {
  if (!text || typeof text !== 'string') {
    return {
      detectedKeywords: [],
      detectedDifficulties: [],
      difficultyScores: {},
      severity: 'normal',
      primaryDifficulty: null
    };
  }

  const normalizedText = text.toLowerCase();
  const detectedKeywords = new Set();
  const detectedDifficulties = new Set();
  const difficultyScores = {};
  let highestSeverity = 'normal';

  for (const def of DIFFICULTY_DEFINITIONS) {
    let matchCount = 0;

    for (const keyword of def.keywords) {
      const escapedKeyword = escapeRegex(keyword);
      // For multi-word phrases or non-ascii words, check inclusion; for single latin words use word boundaries
      const isMultiWord = keyword.includes(' ');
      const isAsciiWord = /^[a-z0-9]+$/i.test(keyword);

      let isMatch = false;
      if (isAsciiWord && !isMultiWord) {
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        isMatch = regex.test(normalizedText);
      } else {
        isMatch = normalizedText.includes(keyword.toLowerCase());
      }

      if (isMatch) {
        detectedKeywords.add(keyword);
        matchCount++;
      }
    }

    if (matchCount > 0) {
      detectedDifficulties.add(def.category);
      difficultyScores[def.category] = matchCount;

      if (def.severity === 'crisis') {
        highestSeverity = 'crisis';
      } else if (highestSeverity !== 'crisis') {
        highestSeverity = 'moderate';
      }
    }
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

  return {
    detectedKeywords: keywordsArray,
    detectedDifficulties: difficultiesArray,
    difficultyScores,
    severity: highestSeverity,
    primaryDifficulty
  };
}

module.exports = {
  DIFFICULTY_DEFINITIONS,
  analyzeMessage
};

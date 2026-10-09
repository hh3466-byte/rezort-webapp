const fs = require('fs');

/**
 * Checks whether a text string simply indicates normal health, regular food,
 * or absence of problems (e.g. "בריא לחלוטין", "אין תרופות", "אוכל רגיל", "הכל בסדר").
 */
function isNormalText(raw) {
  if (!raw) return true;
  let t = raw.trim().toLowerCase();
  if (!t) return true;

  // Single word / punctuation / placeholders
  if (/^(\.|-|_|\/|na|n\/a|none|אין|לא|ללא|בלי|רגיל|רגילה|טוב|טובה|הכל טוב|הכל בסדר|הכל תקין|הכל מעולה|בסדר גמור|בריא|בריאה|בריא לחלוטין|בריאה לחלוטין|שום דבר|לא רלוונטי|כלום|אין משהו מיוחד|אין משהו|אין בעיה|אין שום בעיה|אין תרופות|ללא תרופות|אין צרכים מיוחדים|ללא צרכים מיוחדים|אין אלרגיות|ללא אלרגיות|אין רגישויות|אוכל רגיל|אוכל יבש|אוכל יבש רגיל|מזון רגיל|בונזו|דוגלי|רויאל קנין|פרופלאן|טופ דוג|מונג'|בלקנדו|אקאנה|הפי דוג|מזון יבש|חברותי|חברותית|מקסים|אוהב אנשים|אוהב כלבים|אין הערות|ללא הערות|בסדר|מעולה|אין צורך|אין שום צורך|ללא הגבלה|מטופל|מחוסן|מסורס|מעוקרת)$/.test(t)) {
    return true;
  }

  // 1. Remove parenthetical affirmations/negations e.g. "(אין תרופות או צרכים מיוחדים)"
  t = t.replace(/\([^)]*(אין|ללא|לא|בלי|בריא|תקין|רגיל|בסדר|טוב|מעולה|מצוין)[^)]*\)/g, ' ');

  // 2. Strip standard negative normal affirmations
  t = t.replace(/(אין|ללא|לא|בלי|אפס)\s+(שום\s+)?(תרופות|תרופה|צרכים|צורך|בעיות|בעיה|תוקפנות|נשיכות|אלרגיות|אלרגיה|מחלות|מחלה|ניתוחים|ניתוח|חרדה|פחד|סכנה|נזק|אגרסיביות|רכושנות|טיפול|טיפולים|רגישות|רגישויות|דגשים|דגש|הערות|הערה)/g, ' ');
  t = t.replace(/(לא|אינו|אינה)\s+(נושך|תוקף|בורח|פוחד|הורס|קופץ|רגיש|חולה|מפחד|מקבל|נוטלת|נוטל|אגרסיבי)/g, ' ');
  t = t.replace(/בריא(ה)?(\s+לחלוטין)?/g, ' ');
  t = t.replace(/הכל\s+(בסדר|תקין|טוב|מעולה|גמור|רגיל|מצוין)/g, ' ');

  // 3. Clean punctuation & digits
  const cleaned = t
    .replace(/[0-9.,/#!$%^&*;:{}=\-_`~()?"'\\+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return true;

  const words = cleaned.split(' ').filter(Boolean);
  if (words.length === 0) return true;

  // Dictionary of known normal words (with Hebrew prefix stripping support)
  const normalKeywords = new Set([
    'אין', 'לא', 'ללא', 'בלי', 'בריא', 'בריאה', 'לחלוטין', 'תקין', 'תקינה', 'בסדר', 'גמור',
    'טוב', 'טובה', 'טובים', 'טובות', 'מעולה', 'מצוין', 'מצוינת', 'רגיל', 'רגילה', 'רגילים', 'שום', 'דבר', 'רלוונטי', 'כלום', 'משהו',
    'מיוחד', 'מיוחדים', 'מיוחדת', 'צרכים', 'צורך', 'תרופות', 'תרופה', 'בעיה', 'בעיות', 'הערות', 'הערה',
    'הכל', 'הכול', 'אוכל', 'יבש', 'רטוב', 'מזון', 'בונזו', 'דוגלי', 'קנין', 'רויאל', 'פרופלאן', 'מונג', 'אקאנה',
    'חברותי', 'חברותית', 'חברותיים', 'חברותיות', 'שמח', 'שמחה', 'אוהב', 'אוהבת', 'אוהבים', 'אוהבות', 'אנשים', 'כלבים', 'משחק', 'משחקים',
    'מקסים', 'מקסימה', 'חמוד', 'חמודה', 'מתוק', 'מתוקה', 'רגוע', 'רגועה', 'נוח', 'נוחה', 'מדהים', 'מדהימה',
    'בוקר', 'ערב', 'צהריים', 'לילה', 'גרם', 'כוס', 'כוסות', 'פעמיים', 'פעם', 'ביום', 'מים', 'קערה', 'מנה', 'מנות',
    'כלב', 'כלבה', 'גור', 'גורה', 'שקט', 'שקטה', 'עדין', 'עדינה', 'עם', 'של', 'על', 'מאוד', 'מאד', 'רק', 'או', 'כי',
    'הוא', 'היא', 'זה', 'זו', 'אצל', 'יחד', 'לשחק', 'לשחקנים'
  ]);

  const stripHebrewPrefix = (w) => {
    if (normalKeywords.has(w)) return w;
    // Try stripping single letter prefix: ו, ה, ב, כ, ל, מ, ש
    if (w.length > 2 && /^[והבכלמש]/.test(w)) {
      const stripped = w.slice(1);
      if (normalKeywords.has(stripped)) return stripped;
    }
    // Try stripping double prefix: וה, וכ, ול, ומ, וש
    if (w.length > 3 && /^ו[הבכלמש]/.test(w)) {
      const stripped = w.slice(2);
      if (normalKeywords.has(stripped)) return stripped;
    }
    return w;
  };

  const allWordsNormal = words.every(w => {
    const canonical = stripHebrewPrefix(w);
    return normalKeywords.has(canonical);
  });

  if (allWordsNormal) {
    return true;
  }

  // If text contains ANY red flags (drugs, aggressive behavior, escape risk, severe disease)
  const redFlagPattern = /נושך|נשיכות|תוקפנ|תוקף|אגרסיב|רכושנ|נוהם|מגרגר|בורח|בריח|קופץ\s+מעל|חרדת\s+נטישה|אפילפס|סוכרת|עיוור|חירש|זריקות|זריקה|טיפות|אנטיביוט|משחה|חולה|מחלה|אלרג|ניתוח\s+חדש|צליעה|פצוע|כדור|כדורים|נקסטגארד|ברבקטו|סימפריקה|אילוף|אינסולין/;
  if (redFlagPattern.test(cleaned)) {
    return false;
  }

  // If no red flag exists, treat general positive/normal statements as normal
  return true;
}

function extractProblemSemanticAlerts(dogName, notesRaw) {
  if (!notesRaw) return [];
  let t = notesRaw.toLowerCase();

  // 1. Strip parenthetical negations e.g. "(אין תרופות או צרכים מיוחדים)"
  t = t.replace(/\([^)]*(אין|ללא|לא|בלי|בריא|תקין|רגיל|בסדר|טוב|מעולה|מצוין)[^)]*\)/g, ' ');

  // 2. Strip negative phrases e.g. "אין תוקפנות", "לא נושך", "ללא אלרגיה", "אין תרופות", "ללא ניתוחים"
  t = t.replace(/(אין|ללא|לא|בלי|אפס)\s+(שום\s+)?(תרופות|תרופה|צרכים|צורך|בעיות|בעיה|תוקפנות|נשיכות|אלרגיות|אלרגיה|מחלות|מחלה|ניתוחים|ניתוח|חרדה|פחד|סכנה|נזק|אגרסיביות|רכושנות|טיפול|טיפולים|רגישות|רגישויות|דגשים|דגש|הערות|הערה)/g, ' ');
  t = t.replace(/(לא|אינו|אינה)\s+(נושך|תוקף|בורח|פוחד|הורס|קופץ|רגיש|חולה|מפחד|מקבל|נוטלת|נוטל|אגרסיבי)/g, ' ');
  t = t.replace(/בריא(ה)?(\s+לחלוטין)?/g, ' ');
  t = t.replace(/הכל\s+(בסדר|תקין|טוב|מעולה|גמור|רגיל|מצוין)/g, ' ');

  const alerts = [];

  // 1. Positive Aggression triggers
  if (/(^|\s)(נושך|נשיכות|תוקפנ|תוקף|אגרסיב|רכושנ|נוהם|מגרגר)($|\s)/.test(t)) {
    alerts.push({ type: 'behavior_flag', title: 'Aggression' });
  }

  // 2. Positive Escape / Severe Anxiety triggers
  if (/(^|\s)(בורח|בריח|קופץ\s+מעל\s+גדר|מטפס\s+על\s+גדר|חרדת\s+נטישה\s+קשה|הורס\s+דלתות|הורס\s+כלובים)($|\s)/.test(t)) {
    alerts.push({ type: 'escape_flag', title: 'Escape' });
  }

  // 3. Positive Critical Medical triggers
  if (/(^|\s)(אפילפס|סוכרת|עיוור|חירש|ניתוח\s+שעבר\s+לאחרונה|צליעה\s+קשה|זריקות\s+אינסולין|אלרגיה\s+חמורה|התקפי\s+אפילפסיה)($|\s)/.test(t)) {
    alerts.push({ type: 'medical_flag', title: 'Medical' });
  }

  return alerts;
}

const testCases = [
  "בריא לחלוטין (אין תרופות או צרכים מיוחדים)",
  "בריא לחלוטין",
  "אין תרופות",
  "אין צרכים מיוחדים",
  "אוכל יבש רגיל",
  "הכל בסדר גמור",
  "כלב מקסים וחברותי",
  "לא נושך, אין בעיות",
  "-",
  ".",
  "רויאל קנין 2 כוסות ביום",
  "אין הערות",
  "מתוק ואוהב לשחק עם כלבים",
  "הכל תקין, ללא תרופות",
  "מזון בונזו בוקר וערב"
];

console.log("Testing Normal Texts (All should be TRUE and 0 alerts):");
let allPassNormal = true;
for (const tc of testCases) {
  const res = isNormalText(tc);
  const sem = extractProblemSemanticAlerts("כלב", tc);
  const pass = res && sem.length === 0;
  if (!pass) allPassNormal = false;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] "${tc}" -> isNormal: ${res}, semAlerts: ${sem.length}`);
}

const abnormalCases = [
  "נושך כשנוגעים באוכל",
  "בורח מכלובים וקופץ מעל גדר",
  "חולה אפילפסיה ומקבל כדורים",
  "עיוור בעין שמאל וצריך טיפות",
  "צריך כדור נקסטגארד בבוקר"
];

console.log("\nTesting Abnormal Texts (All should be FALSE / Trigger alerts):");
let allPassAbnormal = true;
for (const tc of abnormalCases) {
  const res = isNormalText(tc);
  const sem = extractProblemSemanticAlerts("כלב", tc);
  const pass = !res || sem.length > 0;
  if (!pass) allPassAbnormal = false;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] "${tc}" -> isNormal: ${res}, semAlerts: ${sem.length}`);
}

console.log(`\nOVERALL: Normal tests: ${allPassNormal ? 'ALL PASSED ✅' : 'FAILED ❌'}, Abnormal tests: ${allPassAbnormal ? 'ALL PASSED ✅' : 'FAILED ❌'}`);

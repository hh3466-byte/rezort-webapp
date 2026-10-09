/**
 * Utility for detecting irregularities, special conditions, and critical alerts
 * in dog intake questionnaires and bookings for Shmulik (Resort Manager).
 * 
 * Strict Rule: If everything is normal and healthy (no irregularities),
 * return an empty array so NO alert banner or warning is displayed at all.
 */

export interface IntakeAlertItem {
  id: string;
  type: 'unneutered_male' | 'unspayed_female' | 'unvaccinated' | 'not_friendly' | 'depends_friendly' | 'not_house_trained' | 'untreated_parasites' | 'medications' | 'special_diet' | 'special_needs' | 'behavior_flag' | 'medical_flag' | 'escape_flag';
  severity: 'danger' | 'warning' | 'info';
  title: string;
  badgeLabel: string;
  description: string;
  dogName?: string;
  highlightText?: string;
}

/**
 * Checks whether a text string simply indicates normal health, regular food,
 * or absence of problems (e.g. "בריא לחלוטין", "אין תרופות", "אוכל רגיל", "הכל בסדר").
 */
export function isNormalText(raw?: string): boolean {
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

  const stripHebrewPrefix = (w: string) => {
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

/**
 * Scan free-text notes for actual, genuine behavioral or medical red flags,
 * carefully ignoring negations (e.g. "לא נושך", "אין תוקפנות", "ללא אלרגיה").
 */
function extractProblemSemanticAlerts(dogName: string, notesRaw?: string): IntakeAlertItem[] {
  if (!notesRaw) return [];
  let t = notesRaw.toLowerCase();

  // 1. Strip parenthetical negations e.g. "(אין תרופות או צרכים מיוחדים)"
  t = t.replace(/\([^)]*(אין|ללא|לא|בלי|בריא|תקין|רגיל|בסדר|טוב|מעולה|מצוין)[^)]*\)/g, ' ');

  // 2. Strip negative phrases e.g. "אין תוקפנות", "לא נושך", "ללא אלרגיה", "אין תרופות", "ללא ניתוחים"
  t = t.replace(/(אין|ללא|לא|בלי|אפס)\s+(שום\s+)?(תרופות|תרופה|צרכים|צורך|בעיות|בעיה|תוקפנות|נשיכות|אלרגיות|אלרגיה|מחלות|מחלה|ניתוחים|ניתוח|חרדה|פחד|סכנה|נזק|אגרסיביות|רכושנות|טיפול|טיפולים|רגישות|רגישויות|דגשים|דגש|הערות|הערה)/g, ' ');
  t = t.replace(/(לא|אינו|אינה)\s+(נושך|תוקף|בורח|פוחד|הורס|קופץ|רגיש|חולה|מפחד|מקבל|נוטלת|נוטל|אגרסיבי)/g, ' ');
  t = t.replace(/בריא(ה)?(\s+לחלוטין)?/g, ' ');
  t = t.replace(/הכל\s+(בסדר|תקין|טוב|מעולה|גמור|רגיל|מצוין)/g, ' ');

  const alerts: IntakeAlertItem[] = [];

  // 1. Positive Aggression triggers
  if (/(^|\s)(נושך|נשיכות|תוקפנ|תוקף|אגרסיב|רכושנ|נוהם|מגרגר)($|\s)/.test(t)) {
    alerts.push({
      id: `${dogName}-aggression-flag`,
      type: 'behavior_flag',
      severity: 'danger',
      dogName,
      title: `🚨 ${dogName}: הערת תוקפנות / נשיכות בטופס!`,
      badgeLabel: `🚨 ${dogName}: סכנת נשיכות/תוקפנות`,
      description: 'בטופס צוינו דגשים המעידים על תוקפנות, נשיכות או רכושנות.'
    });
  }

  // 2. Positive Escape / Severe Anxiety triggers
  if (/(^|\s)(בורח|בריח|קופץ\s+מעל\s+גדר|מטפס\s+על\s+גדר|חרדת\s+נטישה\s+קשה|הורס\s+דלתות|הורס\s+כלובים)($|\s)/.test(t)) {
    alerts.push({
      id: `${dogName}-escape-flag`,
      type: 'escape_flag',
      severity: 'warning',
      dogName,
      title: `⚠️ ${dogName}: נטייה לבריחה / חרדת נטישה / קפיצת גדר`,
      badgeLabel: `⚠️ ${dogName}: סכנת בריחה/חרדה`,
      description: 'בטופס צוינו דגשים המעידים על נטייה לבריחה, קפיצה מעל גדרות או חרדת נטישה.'
    });
  }

  // 3. Positive Critical Medical triggers
  if (/(^|\s)(אפילפס|סוכרת|עיוור|חירש|ניתוח\s+שעבר\s+לאחרונה|צליעה\s+קשה|זריקות\s+אינסולין|אלרגיה\s+חמורה|התקפי\s+אפילפסיה)($|\s)/.test(t)) {
    alerts.push({
      id: `${dogName}-medical-flag`,
      type: 'medical_flag',
      severity: 'warning',
      dogName,
      title: `🩺 ${dogName}: רקע רפואי מיוחד (אלרגיה/מחלה/ניתוח)`,
      badgeLabel: `🩺 ${dogName}: רקע רפואי מיוחד`,
      description: 'בטופס צוינו פרטים רפואיים מיוחדים (אלרגיה, מחלה כרונית, עיוורון, או ניתוח עבר).'
    });
  }

  return alerts;
}

export function detectIntakeAlerts(data: {
  dogName?: string;
  dogGender?: 'male' | 'female' | 'male_neutered' | 'female_spayed' | 'male_intact' | 'female_intact' | string;
  isNeutered?: boolean;
  isVaccinated?: boolean;
  vaccinationValid?: boolean;
  isFriendlyWithDogs?: 'yes' | 'no' | 'depends' | string | boolean;
  isHouseTrained?: boolean;
  isTreatedParasites?: boolean;
  specialNeeds?: string;
  specialDiet?: string;
  medications?: string;
  medicationSchedule?: string;
  notes?: string;
  behaviorNotes?: string;
  internalNotes?: string;
  additionalDogs?: any[];
}): IntakeAlertItem[] {
  const alerts: IntakeAlertItem[] = [];
  const primaryDogName = data.dogName || 'הכלב';

  // Helper to inspect a single dog profile
  const checkSingleDog = (
    dogName: string,
    genderRaw: string | undefined,
    isNeuteredRaw: boolean | undefined,
    isVaccinatedRaw: boolean | undefined,
    isFriendlyRaw: string | boolean | undefined,
    isHouseTrainedRaw: boolean | undefined,
    isTreatedParasitesRaw: boolean | undefined,
    specialNeedsRaw?: string,
    specialDietRaw?: string,
    medicationsRaw?: string,
    notesRaw?: string
  ) => {
    // 1. Gender & Neutered / Spayed check: ONLY unneutered males trigger pricing/isolation alert
    const isExplicitMaleIntact = genderRaw === 'male_intact';
    const isMale = isExplicitMaleIntact || genderRaw === 'male' || genderRaw === 'male_neutered';
    const isNeutered = isNeuteredRaw !== undefined
      ? isNeuteredRaw
      : (genderRaw === 'male_neutered' || genderRaw === 'female_spayed');

    if (isExplicitMaleIntact || (isMale && isNeutered === false)) {
      alerts.push({
        id: `${dogName}-unneutered-male`,
        type: 'unneutered_male',
        severity: 'danger',
        dogName,
        title: `${dogName}: זכר לא מסורס (תעריף ₪230/יום + השגחה מופרדת)`,
        badgeLabel: `⚠️ ${dogName} זכר לא מסורס (₪230 ליום)`,
        description: 'זכרים לא מסורסים מחייבים הפרדת חצרות והשגחה אישית. המערכת מחשבת תעריף בידוד של ₪230 ליום ללא הנחות משך.'
      });
    }

    // 2. Vaccinations: ONLY missing vaccines trigger an alert
    const isVaccinated = isVaccinatedRaw !== undefined ? isVaccinatedRaw : data.vaccinationValid;
    if (isVaccinated === false) {
      alerts.push({
        id: `${dogName}-unvaccinated`,
        type: 'unvaccinated',
        severity: 'danger',
        dogName,
        title: `🚨 ${dogName}: חיסונים חסרים / לא בתוקף!`,
        badgeLabel: `💉 ${dogName} לא מחוסן בתוקף!`,
        description: 'הלקוח סימן שהחיסונים אינם בתוקף. חובה לבדוק פנקס חיסונים מעודכן טרם אישור הקליטה.'
      });
    }

    // 3. Friendly with Dogs / Isolation: ONLY aggressive / isolation dogs trigger alert
    if (isFriendlyRaw === 'no' || isFriendlyRaw === false) {
      alerts.push({
        id: `${dogName}-not-friendly`,
        type: 'not_friendly',
        severity: 'danger',
        dogName,
        title: `🚫🐕 ${dogName}: לא מסתדר עם כלבים (חייב בידוד וחצר נפרדת)`,
        badgeLabel: `🚫🐕 ${dogName} לא מסתדר עם כלבים (בידוד)`,
        description: 'הכלב אינו חברותי לכלבים אחרים או תוקפני. יש לשבץ במתחם מופרד ולמנוע מגע ישיר.'
      });
    } else if (isFriendlyRaw === 'depends') {
      alerts.push({
        id: `${dogName}-depends-friendly`,
        type: 'depends_friendly',
        severity: 'warning',
        dogName,
        title: `🟡 ${dogName}: מסתדר עם כלבים: תלוי / זהיר`,
        badgeLabel: `🟡 ${dogName} תלוי / זהיר עם כלבים`,
        description: 'ההסתדרות עם כלבים תלויה באופי הכלב השני. מומלץ לבצע היכרות הדרגתית ומפוקחת.'
      });
    }

    // 4. House Trained: ONLY if NOT house trained
    if (isHouseTrainedRaw === false) {
      alerts.push({
        id: `${dogName}-not-house-trained`,
        type: 'not_house_trained',
        severity: 'warning',
        dogName,
        title: `🚽⚠️ ${dogName}: אינו מחונך לצרכים`,
        badgeLabel: `🚽 ${dogName} לא מחונך לצרכים`,
        description: 'הכלב אינו מחונך לצרכים – נדרשות יציאות תכופות יותר לחצר וניקוי מוגבר.'
      });
    }

    // 5. Parasite Treatment: ONLY if NOT treated
    if (isTreatedParasitesRaw === false) {
      alerts.push({
        id: `${dogName}-untreated-parasites`,
        type: 'untreated_parasites',
        severity: 'warning',
        dogName,
        title: `🐜⚠️ ${dogName}: אינו מטופל נגד קרציות/פרעושים`,
        badgeLabel: `🐜 ${dogName} ללא טיפול נגד קרציות`,
        description: 'הכלב אינו מטופל נגד טפילים. יש לתת טיפול מונע בכניסה לשמירה על שאר הכלבים.'
      });
    }

    // 6. Medications: ONLY if actual medications exist and it's not a normal/healthy text
    const medsText = (medicationsRaw || '').trim();
    if (medsText && !isNormalText(medsText)) {
      alerts.push({
        id: `${dogName}-medications`,
        type: 'medications',
        severity: 'info',
        dogName,
        title: `💊 ${dogName}: מקבל תרופות / טיפול רפואי`,
        badgeLabel: `💊 ${dogName}: תרופות (${truncate(medsText, 25)})`,
        description: `הנחיות תרופות: ${medsText}`,
        highlightText: medsText
      });
    }

    // 7. Special Diet: ONLY if actual special medical diet exists (not regular kibble brands)
    const dietText = (specialDietRaw || '').trim();
    if (dietText && !isNormalText(dietText)) {
      alerts.push({
        id: `${dogName}-special-diet`,
        type: 'special_diet',
        severity: 'info',
        dogName,
        title: `🍲 ${dogName}: מזון מיוחד / הנחיות האכלה`,
        badgeLabel: `🍲 ${dogName}: מזון מיוחד (${truncate(dietText, 25)})`,
        description: `הנחיות מזון: ${dietText}`,
        highlightText: dietText
      });
    }

    // 8. Special Needs: ONLY if actual special needs exist and not normal/healthy statements
    const needsText = (specialNeedsRaw || '').trim();
    if (needsText && !isNormalText(needsText)) {
      alerts.push({
        id: `${dogName}-special-needs`,
        type: 'special_needs',
        severity: 'warning',
        dogName,
        title: `🩺 ${dogName}: צרכים מיוחדים / דגשים`,
        badgeLabel: `🩺 ${dogName}: צרכים מיוחדים (${truncate(needsText, 25)})`,
        description: `דגשים מיוחדים: ${needsText}`,
        highlightText: needsText
      });
    }

    // 9. Semantic problem scans in notes (aggression, escape, severe disease)
    const semanticAlerts = extractProblemSemanticAlerts(dogName, `${notesRaw || ''}`);
    alerts.push(...semanticAlerts);
  };

  // Run check on primary dog
  checkSingleDog(
    primaryDogName,
    data.dogGender,
    data.isNeutered,
    data.isVaccinated,
    data.isFriendlyWithDogs,
    data.isHouseTrained,
    data.isTreatedParasites,
    data.specialNeeds,
    data.specialDiet,
    data.medications,
    `${data.notes || ''} ${data.behaviorNotes || ''}`
  );

  // Run check on additional dogs if present
  if (data.additionalDogs && Array.isArray(data.additionalDogs)) {
    data.additionalDogs.forEach((ad) => {
      if (ad && (ad.dogName || '').trim()) {
        const adName = ad.dogName.trim();
        checkSingleDog(
          adName,
          ad.dogGender,
          ad.isNeutered,
          ad.isVaccinated,
          ad.isFriendlyWithDogs,
          ad.isHouseTrained,
          ad.isTreatedParasites,
          ad.specialNeeds,
          ad.specialDiet,
          ad.medications,
          ad.notes
        );
      }
    });
  }

  return alerts;
}

function truncate(str: string, len: number): string {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

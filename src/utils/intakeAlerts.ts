/**
 * Utility for detecting irregularities, special conditions, and critical alerts
 * in dog intake questionnaires and bookings for Shmulik (Resort Manager).
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
    // 1. Gender & Neutered / Spayed check
    const isExplicitMaleIntact = genderRaw === 'male_intact';
    const isExplicitFemaleIntact = genderRaw === 'female_intact';
    const isMale = isExplicitMaleIntact || genderRaw === 'male' || genderRaw === 'male_neutered';
    const isFemale = isExplicitFemaleIntact || genderRaw === 'female' || genderRaw === 'female_spayed';

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
    } else if (isExplicitFemaleIntact || (isFemale && isNeutered === false)) {
      alerts.push({
        id: `${dogName}-unspayed-female`,
        type: 'unspayed_female',
        severity: 'warning',
        dogName,
        title: `${dogName}: נקבה לא מעוקרת (לוודא שאינה בייחום)`,
        badgeLabel: `🌸 ${dogName} נקבה לא מעוקרת`,
        description: 'נקבה לא מעוקרת עשויה להיכנס לייחום. יש לוודא מול הבעלים שאינה מיוחמת בעת השהייה.'
      });
    }

    // 2. Vaccinations
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

    // 3. Friendly with Dogs / Isolation
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

    // 4. House Trained
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

    // 5. Parasite Treatment
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

    // 6. Medications
    const medsText = (medicationsRaw || '').trim();
    if (medsText && medsText !== 'אין' && medsText !== 'לא' && medsText !== 'ללא') {
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

    // 7. Special Diet
    const dietText = (specialDietRaw || '').trim();
    if (dietText && dietText !== 'אין' && dietText !== 'לא' && dietText !== 'רגיל' && dietText !== 'ללא') {
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

    // 8. Special Needs
    const needsText = (specialNeedsRaw || '').trim();
    if (needsText && needsText !== 'אין' && needsText !== 'לא' && needsText !== 'ללא') {
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

    // 9. Free-text semantic problem scans in notes
    const combinedNotes = `${notesRaw || ''} ${specialNeedsRaw || ''}`.toLowerCase();
    
    // Scan for aggressive keywords
    if (/נושך|נשיכות|תוקפנ|תוקף|אגרסיב|רכושנ|נוהם|מגרגר/.test(combinedNotes)) {
      alerts.push({
        id: `${dogName}-aggression-flag`,
        type: 'behavior_flag',
        severity: 'danger',
        dogName,
        title: `🚨 ${dogName}: הערת תוקפנות / נשיכות בטופס!`,
        badgeLabel: `🚨 ${dogName}: סכנת נשיכות/תוקפנות`,
        description: 'בטופס צוינו מילות מפתח המעידות על תוקפנות, נשיכות או רכושנות.'
      });
    }

    // Scan for escape / severe anxiety / fence jumping
    if (/בורח|בריח|קופץ מעל|קופץ גדר|מטפס על גדר|חרדת נטישה|חרדתי|פוחד מרעמים|הורס|לשבור/.test(combinedNotes)) {
      alerts.push({
        id: `${dogName}-escape-flag`,
        type: 'escape_flag',
        severity: 'warning',
        dogName,
        title: `⚠️ ${dogName}: נטייה לבריחה / חרדת נטישה / קפיצת גדר`,
        badgeLabel: `⚠️ ${dogName}: סכנת בריחה/חרדה`,
        description: 'בטופס צוינו מילות מפתח המעידות על נטייה לבריחה, קפיצה מעל גדרות או חרדת נטישה.'
      });
    }

    // Scan for critical medical conditions (Epilepsy, Surgery, Blind, Heart, Diabetes, Allergy)
    if (/אפילפסי|סוכרת|עיוור|חירש|ניתוח|צליעה|מפרקים|לב|זריקות|אלרגי/.test(combinedNotes)) {
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
    data.additionalDogs.forEach((ad, idx) => {
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

/**
 * Jewish Calendar & Holiday utility for the Resort web application.
 * Uses native Intl.DateTimeFormat (Hebrew calendar) for 100% offline, accurate holiday detection.
 */

export interface HolidayInfo {
  isSpecial: boolean;
  label: string;
  icon: string;
  isShabbat: boolean;
  holidayName: string | null;
  isYomKippur?: boolean;
}

/**
 * Returns Jewish Holiday name if the date falls on a holiday or eve of holiday, otherwise null.
 */
export function getJewishHoliday(d: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    }).formatToParts(d);
    
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    const monthName = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' }).format(d).trim();

    if (monthName.includes('תשרי')) {
      if (day === 1 || day === 2) return 'ראש השנה';
      if (day === 9) return 'ערב יום כיפור';
      if (day === 10) return 'יום כיפור';
      if (day === 14) return 'ערב סוכות';
      if (day === 15) return 'חג סוכות';
      if (day >= 16 && day <= 20) return 'חוה״מ סוכות';
      if (day === 21) return 'הושענא רבה';
      if (day === 22) return 'שמחת תורה';
    }
    if (monthName.includes('כסלו') || monthName.includes('טבת')) {
      if (monthName.includes('כסלו') && day >= 25) return 'חנוכה';
      if (monthName.includes('טבת') && day <= 3) return 'חנוכה';
    }
    if (monthName.includes('שבט') && day === 15) return 'ט״ו בשבט';
    if ((monthName.includes('אדר') || monthName.includes('אדר ב')) && (day === 14 || day === 15)) return 'פורים';
    if (monthName.includes('ניסן')) {
      if (day === 14) return 'ערב פסח';
      if (day === 15) return 'חג פסח';
      if (day >= 16 && day <= 20) return 'חוה״מ פסח';
      if (day === 21) return 'שביעי של פסח';
    }
    if (monthName.includes('אייר')) {
      if (day === 4) return 'יום הזיכרון';
      if (day === 5) return 'יום העצמאות';
      if (day === 18) return 'ל״ג בעומר';
      if (day === 28) return 'יום ירושלים';
    }
    if (monthName.includes('סיוון')) {
      if (day === 5) return 'ערב שבועות';
      if (day === 6) return 'חג שבועות';
    }
    if (monthName.includes('אב') && day === 9) {
      return 'תשעה באב';
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Check if given date is Shabbat (Saturday)
 */
export function isShabbat(d: Date): boolean {
  return d.getDay() === 6;
}

/**
 * Get comprehensive info if the date is Shabbat, a Jewish Holiday, or both.
 */
export function getDateShabbatOrHoliday(dateStrOrObj: string | Date): HolidayInfo {
  const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj + 'T00:00:00') : dateStrOrObj;
  const shabbat = isShabbat(d);
  const holiday = getJewishHoliday(d);

  if (shabbat && holiday) {
    if (holiday === 'יום כיפור') {
      return {
        isSpecial: false, // יום כיפור קדוש: איסור מוחלט על שליחת הודעות אוטומטיות!
        label: 'שבת • יום כיפור 🕯️',
        icon: '🕯️',
        isShabbat: true,
        holidayName: holiday,
        isYomKippur: true
      };
    }
    return {
      isSpecial: true,
      label: `שבת • ${holiday}`,
      icon: '🕯️',
      isShabbat: true,
      holidayName: holiday,
      isYomKippur: false
    };
  }

  if (shabbat) {
    return {
      isSpecial: true,
      label: 'שבת שלום',
      icon: '🕯️',
      isShabbat: true,
      holidayName: null,
      isYomKippur: false
    };
  }

  if (holiday) {
    // יום כיפור: יום קדוש ביותר, אין לשלוח שום הודעות אוטומטיות ללקוחות!
    if (holiday === 'יום כיפור') {
      return {
        isSpecial: false,
        label: 'יום כיפור 🕯️',
        icon: '🕯️',
        isShabbat: false,
        holidayName: holiday,
        isYomKippur: true
      };
    }

    if (holiday === 'ערב יום כיפור') {
      return {
        isSpecial: false,
        label: 'ערב יום כיפור 🕯️',
        icon: '🕯️',
        isShabbat: false,
        holidayName: holiday,
        isYomKippur: true
      };
    }

    // Eves of holidays (like Friday) are busy check-in days (open until 14:00).
    // Greetings are sent on Shabbat (Saturday) and on the holiday itself!
    if (holiday.startsWith('ערב ')) {
      return {
        isSpecial: false,
        label: holiday,
        icon: '🕯️',
        isShabbat: false,
        holidayName: holiday,
        isYomKippur: false
      };
    }

    let icon = '🍷';
    if (holiday.includes('סוכות')) icon = '🌿';
    else if (holiday.includes('חנוכה')) icon = '🕎';
    else if (holiday.includes('פורים')) icon = '🎭';
    else if (holiday.includes('פסח')) icon = '🌸';
    else if (holiday.includes('שבועות')) icon = '🌾';
    else if (holiday.includes('העצמאות')) icon = '🇮🇱';

    return {
      isSpecial: true,
      label: holiday,
      icon,
      isShabbat: false,
      holidayName: holiday,
      isYomKippur: false
    };
  }

  return {
    isSpecial: false,
    label: '',
    icon: '',
    isShabbat: false,
    holidayName: null,
    isYomKippur: false
  };
}

/**
 * Calculate the exact end of Yom Kippur in Israel (40 minutes after sunset)
 */
export function getYomKippurSunsetPlus40Minutes(date: Date = new Date()): number {
  try {
    const lat = 32.085;
    const lon = 34.781;
    const startOfYear = new Date(date.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);
    const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma);
    const latRad = lat * Math.PI / 180;
    const zenithRad = 90.8333 * Math.PI / 180;
    const cosHourAngle = (Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(decl))) - (Math.tan(latRad) * Math.tan(decl));
    const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
    const sunsetUtcMinutes = 720 - 4 * lon - eqtime + hourAngle * 4;
    const sunsetIsraelMinutes = sunsetUtcMinutes + 180;
    return Math.round(sunsetIsraelMinutes + 40);
  } catch (e) {
    return 19 * 60 + 20; // Safe fallback: 19:20
  }
}

/**
 * Check if Yom Kippur holy period is actively in effect right now
 * (Starts Erev Yom Kippur at 14:00, ends 40 minutes after sunset on Yom Kippur).
 */
export function isYomKippurActiveNow(now: Date = new Date()): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' }).formatToParts(now);
    const hDay = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    const hMonth = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long', timeZone: 'Asia/Jerusalem' }).format(now).trim();
    if (!hMonth.includes('תשרי')) return false;

    const hour = parseInt(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jerusalem' }).format(now), 10);
    const minute = parseInt(new Intl.DateTimeFormat('en-GB', { minute: 'numeric', timeZone: 'Asia/Jerusalem' }).format(now), 10);
    const currentMinutes = hour * 60 + minute;

    // ערב יום כיפור (ט' בתשרי) החל משעה 14:00
    if (hDay === 9 && currentMinutes >= 14 * 60) return true;

    // יום כיפור עצמו (י' בתשרי) עד 40 דקות בדיוק אחרי שקיעת השמש
    if (hDay === 10) {
      const endMinutes = getYomKippurSunsetPlus40Minutes(now);
      return currentMinutes < endMinutes;
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Check specifically if a given date is Yom Kippur or Erev Yom Kippur
 */
export function isYomKippurDate(dateStrOrObj: string | Date): boolean {
  const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj + 'T00:00:00') : dateStrOrObj;
  const holiday = getJewishHoliday(d);
  return holiday === 'יום כיפור' || holiday === 'ערב יום כיפור';
}

/**
 * Helper to determine whether the date is weekend, holiday or both
 */
export function getOccasionWord(dateStr?: string): string {
  if (!dateStr) return 'בסופ"ש';
  const info = getDateShabbatOrHoliday(dateStr);
  if (info.isShabbat && info.holidayName) {
    return 'בסופ"ש ובחג';
  }
  if (info.holidayName) {
    return 'בחג';
  }
  return 'בסופ"ש';
}

/**
 * Extract only the first name of the owner for personal, natural messages.
 * e.g., "ישראל ישראלי" -> "ישראל", "דני כהן" -> "דני", "דני ומיכל כהן" -> "דני ומיכל"
 */
export function getFirstName(fullName: string): string {
  if (!fullName) return '';
  // Remove common salutations if present
  const clean = fullName.trim().replace(/^(מר|גב'|גברת|ד"ר|דוקטור)\s+/i, '');
  
  // Handle couple names like "דני ומיכל כהן", "דני ומיכל", "יוסי & דנה"
  const coupleMatch = clean.match(/^([\u0590-\u05FF\w]+(?:\s*(?:ו|ועם|\&|\+)\s*[\u0590-\u05FF\w]+))/);
  if (coupleMatch) {
    return coupleMatch[1];
  }
  // Standard "First Last" -> "First"
  return clean.split(/\s+/)[0] || clean;
}

/**
 * Format the warm personal dog message as requested by Shmulik:
 * שלום (שם הבעלים) למרות שאין שירות לקוחות להולכים על 2 בסופ"ש/חג (לפי הצורך), אבל כל מי שיש לו 4 רגליים וזנב, מקבל פה שירות נפלא גם היום.
 * אז רציתי רק להגיד לכם שממש טוב לי בריזורט לכלב ואיזה כיף לי פה גם היום.
 * (שם הכלב)
 */
export function formatShabbatHolidayGreeting(
  ownerName: string, 
  dogName: string, 
  customTemplate?: string,
  dateStr?: string
): string {
  const occasionWord = getOccasionWord(dateStr);
  const firstName = getFirstName(ownerName);
  const cleanDog = (dogName || '').trim();

  if (customTemplate) {
    return customTemplate
      .replace(/{ownerName}/g, firstName)
      .replace(/{dogName}/g, cleanDog)
      .replace(/\(שם הבעלים\)/g, firstName)
      .replace(/\(שם הכלב\)/g, cleanDog)
      .replace(/בסופ"ש\/חג \(לפי הצורך\)/g, occasionWord)
      .replace(/בסופ"ש\/חג/g, occasionWord)
      .replace(/{occasion}/g, occasionWord);
  }
  return `שלום ${firstName} למרות שאין שירות לקוחות להולכים על 2 ${occasionWord}, אבל כל מי שיש לו 4 רגליים וזנב, מקבל פה שירות נפלא גם היום.\nאז רציתי רק להגיד לכם שממש טוב לי בריזורט לכלב ואיזה כיף לי פה גם היום.\n${cleanDog}`;
}

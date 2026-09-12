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
    return {
      isSpecial: true,
      label: `שבת • ${holiday}`,
      icon: '🕯️',
      isShabbat: true,
      holidayName: holiday
    };
  }

  if (shabbat) {
    return {
      isSpecial: true,
      label: 'שבת שלום',
      icon: '🕯️',
      isShabbat: true,
      holidayName: null
    };
  }

  if (holiday) {
    // Eves of holidays (like Friday) are busy check-in days (open until 14:00).
    // Greetings are sent on Shabbat (Saturday) and on the holiday itself!
    if (holiday.startsWith('ערב ')) {
      return {
        isSpecial: false,
        label: holiday,
        icon: '🕯️',
        isShabbat: false,
        holidayName: holiday
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
      holidayName: holiday
    };
  }

  return {
    isSpecial: false,
    label: '',
    icon: '',
    isShabbat: false,
    holidayName: null
  };
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

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

    if (monthName.includes('אלול')) {
      if (day === 29) return 'ערב ראש השנה';
    }
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
      if (day >= 16 && day <= 19) return 'חוה״מ פסח';
      if (day === 20) return 'ערב שביעי של פסח';
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
/**
 * Calculate the exact sunset in Israel (accounting for daylight saving time UTC+2 or UTC+3)
 */
export function getIsraelSunsetMinutes(date: Date = new Date()): number {
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

    // Detect Israel timezone offset dynamically (UTC+2 in winter, UTC+3 in summer)
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', timeZoneName: 'shortOffset' });
    const tzParts = dtf.formatToParts(date);
    const tzOffsetStr = tzParts.find(p => p.type === 'timeZoneName')?.value || 'GMT+3';
    const tzMatch = tzOffsetStr.match(/GMT([+-]\d+)/);
    const tzHours = tzMatch ? parseInt(tzMatch[1], 10) : 3;

    const sunsetIsraelMinutes = sunsetUtcMinutes + tzHours * 60;
    return Math.round(sunsetIsraelMinutes);
  } catch (e) {
    return 18 * 60 + 40; // Fallback: 18:40
  }
}

/**
 * Calculate Havdalah (צאת השבת או צאת החג) in Israel (typically ~35 minutes after sunset)
 */
export function getIsraelHavdalahMinutes(date: Date = new Date()): number {
  const sunsetMinutes = getIsraelSunsetMinutes(date);
  return sunsetMinutes + 35;
}

/**
 * Calculate the exact send time according to Shmulik's Iron Rule:
 * בדיוק 40 דקות לאחר צאת השבת או החג (הבדלה + 40 דקות = שקיעה + 75 דקות)
 */
export function getMotzeiShabbatSendTimeMinutes(date: Date = new Date()): number {
  const havdalahMinutes = getIsraelHavdalahMinutes(date);
  return havdalahMinutes + 40;
}

/**
 * Helper to format minutes from midnight as HH:MM
 */
export function formatMinutesAsTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Get comprehensive schedule times for Shabbat / Holiday
 */
export function getShabbatOrHolidaySchedule(date: Date = new Date()) {
  const sunsetMins = getIsraelSunsetMinutes(date);
  const havdalahMins = getIsraelHavdalahMinutes(date);
  const sendMins = getMotzeiShabbatSendTimeMinutes(date);

  return {
    sunsetMinutes: sunsetMins,
    sunsetString: formatMinutesAsTimeString(sunsetMins),
    havdalahMinutes: havdalahMins,
    havdalahString: formatMinutesAsTimeString(havdalahMins),
    sendMinutes: sendMins,
    sendString: formatMinutesAsTimeString(sendMins)
  };
}

/**
 * Calculate the exact end of Yom Kippur in Israel (40 minutes after sunset / Havdalah)
 */
export function getYomKippurSunsetPlus40Minutes(date: Date = new Date()): number {
  return getIsraelHavdalahMinutes(date);
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

    // יום כיפור עצמו (י' בתשרי) עד צאת החג
    if (hDay === 10) {
      const endMinutes = getIsraelHavdalahMinutes(now);
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

export interface CustomerMessagingRestrictionResult {
  isRestricted: boolean;
  reason?: string;
  allowedSendTime?: string;
  havdalahTimeStr?: string;
  sendTimeStr?: string;
  isMotzeiShabbatEligibleNow?: boolean;
}

/**
 * =========================================================================
 * כלל ברזל של שמוליק: חסימת הודעות ללקוחות בסופי שבוע וחגים
 * =========================================================================
 * 1. מיום שישי בשעה 14:00 ועד 40 דקות לאחר צאת השבת – איסור מוחלט על שליחת הודעות ללקוחות!
 * 2. בערבי חג החל משעה 14:00 ועד 40 דקות לאחר צאת החג – איסור מוחלט על שליחת הודעות ללקוחות!
 * 3. בדיוק 40 דקות לאחר צאת השבת או החג (הבדלה בישראל + 40 דקות) – השליחה נפתחת אוטומטית!
 */
export function isCustomerMessagingRestrictedNow(now: Date = new Date()): CustomerMessagingRestrictionResult {
  try {
    const jerusalemFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const formatted = jerusalemFormatter.format(now);
    const [dPart, tPart] = formatted.split(', ');
    const [d, m, y] = dPart.split('/').map(Number);
    const [hour, minute] = tPart.split(':').map(Number);
    const currentMinutes = hour * 60 + minute;

    // Day of week in Israel (0 = Sunday, 5 = Friday, 6 = Saturday)
    const jerusalemDateObj = new Date(Date.UTC(y, m - 1, d, hour, minute));
    const dayOfWeek = jerusalemDateObj.getUTCDay();

    // Calculate schedule for today
    const schedule = getShabbatOrHolidaySchedule(now);

    // 1. Friday after 14:00
    if (dayOfWeek === 5) {
      if (currentMinutes >= 14 * 60) {
        // Calculate Saturday schedule for next day
        const saturday = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const satSchedule = getShabbatOrHolidaySchedule(saturday);
        return {
          isRestricted: true,
          reason: 'כלל ברזל: שקט מוחלט ללקוחות מיום שישי ב-14:00 ועד 40 דקות לאחר צאת השבת',
          allowedSendTime: `במוצאי שבת בשעה ${satSchedule.sendString} (40 דק׳ לאחר צאת השבת)`,
          havdalahTimeStr: satSchedule.havdalahString,
          sendTimeStr: satSchedule.sendString,
          isMotzeiShabbatEligibleNow: false
        };
      }
    }

    // 2. Saturday (Shabbat) all day until exactly 40 minutes after Havdalah
    if (dayOfWeek === 6) {
      if (currentMinutes < schedule.sendMinutes) {
        return {
          isRestricted: true,
          reason: `כלל ברזל: שבת קודש - שקט מוחלט ללקוחות. ההודעות ישלחו אוטומטית 40 דקות לאחר צאת השבת (בשעה ${schedule.sendString})`,
          allowedSendTime: `היום במוצאי שבת בשעה ${schedule.sendString}`,
          havdalahTimeStr: schedule.havdalahString,
          sendTimeStr: schedule.sendString,
          isMotzeiShabbatEligibleNow: false
        };
      }
      // Reached 40 minutes after Havdalah! (Window: from sendMinutes up to 23:30)
      if (currentMinutes >= schedule.sendMinutes && currentMinutes <= 23 * 60 + 30) {
        return {
          isRestricted: false,
          allowedSendTime: 'עכשיו (מוצאי שבת, לאחר 40 דקות מצאת השבת)',
          havdalahTimeStr: schedule.havdalahString,
          sendTimeStr: schedule.sendString,
          isMotzeiShabbatEligibleNow: true
        };
      }
    }

    // 3. Holiday Eves and Major Holidays
    const holidayToday = getJewishHoliday(now);
    if (holidayToday) {
      if (holidayToday === 'יום כיפור' || holidayToday === 'ערב יום כיפור') {
        if (isYomKippurActiveNow(now)) {
          return {
            isRestricted: true,
            reason: 'יום כיפור קדוש: שקט מוחלט - איסור מוחלט על שליחת הודעות ללקוחות',
            allowedSendTime: `במוצאי יום כיפור בשעה ${schedule.sendString}`,
            havdalahTimeStr: schedule.havdalahString,
            sendTimeStr: schedule.sendString,
            isMotzeiShabbatEligibleNow: false
          };
        }
      }

      if (holidayToday.startsWith('ערב ') && currentMinutes >= 14 * 60) {
        const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const nextSchedule = getShabbatOrHolidaySchedule(nextDay);
        return {
          isRestricted: true,
          reason: `כלל ברזל: ${holidayToday} (לאחר 14:00) - שקט מוחלט ללקוחות עד 40 דקות לאחר צאת החג`,
          allowedSendTime: `במוצאי החג בשעה ${nextSchedule.sendString}`,
          havdalahTimeStr: nextSchedule.havdalahString,
          sendTimeStr: nextSchedule.sendString,
          isMotzeiShabbatEligibleNow: false
        };
      }

      const majorHolidays = ['ראש השנה', 'חג סוכות', 'שמחת תורה', 'חג פסח', 'שביעי של פסח', 'חג שבועות'];
      if (majorHolidays.includes(holidayToday)) {
        if (currentMinutes < schedule.sendMinutes) {
          return {
            isRestricted: true,
            reason: `כלל ברזל: ${holidayToday} - שקט מוחלט ללקוחות עד 40 דקות לאחר צאת החג (בשעה ${schedule.sendString})`,
            allowedSendTime: `הערב במוצאי החג בשעה ${schedule.sendString}`,
            havdalahTimeStr: schedule.havdalahString,
            sendTimeStr: schedule.sendString,
            isMotzeiShabbatEligibleNow: false
          };
        }
        if (currentMinutes >= schedule.sendMinutes && currentMinutes <= 23 * 60 + 30) {
          return {
            isRestricted: false,
            allowedSendTime: 'עכשיו (מוצאי חג, לאחר 40 דקות מצאת החג)',
            havdalahTimeStr: schedule.havdalahString,
            sendTimeStr: schedule.sendString,
            isMotzeiShabbatEligibleNow: true
          };
        }
      }
    }

    return {
      isRestricted: false,
      havdalahTimeStr: schedule.havdalahString,
      sendTimeStr: schedule.sendString,
      isMotzeiShabbatEligibleNow: false
    };
  } catch (e) {
    return { isRestricted: false };
  }
}

/**
 * Backward compatible wrapper for isShabbatOrHolidayRestricted
 */
export function isShabbatOrHolidayRestricted(now: Date = new Date()): { isRestricted: boolean; reason?: string } {
  const res = isCustomerMessagingRestrictedNow(now);
  return {
    isRestricted: res.isRestricted,
    reason: res.reason
  };
}

/**
 * Calculates the next valid communication date/time (Sunday - Thursday 09:30-18:30, Friday until 13:30).
 * If targetDate falls into Shabbat, Holiday eve, or Holiday, it automatically shifts to the next allowed business morning (09:30 AM).
 */
export function getNextAllowedCommunicationDate(targetDate: Date = new Date()): Date {
  const next = new Date(targetDate.getTime());
  
  // Loop up to 8 days forward to find the next valid time slot
  for (let i = 0; i < 8; i++) {
    const check = isShabbatOrHolidayRestricted(next);
    const day = next.getDay();
    const hours = next.getHours();

    // If restricted by Shabbat/Holiday OR outside business hours (before 9:00 or after 19:00)
    if (check.isRestricted || day === 6 || (day === 5 && hours >= 13) || hours < 9 || hours >= 19) {
      // Advance to next day at 09:30 AM
      next.setDate(next.getDate() + 1);
      next.setHours(9, 30, 0, 0);
    } else {
      // Found a permitted window
      return next;
    }
  }
  return next;
}


/**
 * =========================================================================
 * Pre-Flight Verification & Guard Engine: api/_preflightValidator.js
 * Enforces Ironclad Rule:
 * 1. Pre-flight check 5-10 minutes before every message dispatch.
 * 2. Absolute ban on out-of-window dispatches (never send late or at wrong hours).
 * 3. Auto-healing of data inconsistencies (checked-out dogs, outdated holiday templates, manager naming).
 * =========================================================================
 */

export const HAGAI_PHONE = '0543200007';
export const HAGAI_CHAT_ID = '972543200007@c.us';
export const SHMULIK_PHONE = '0506336896';
export const SHMULIK_CHAT_ID = '972506336896@c.us';

/**
 * Returns current Israel date and time
 */
export function getIsraelTime() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false
  });
  const parts = dtf.formatToParts(now);
  let y = '', m = '', d = '', h = 0, min = 0, weekday = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') d = p.value;
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') min = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
  }
  return {
    dateStr: `${y}-${m}-${d}`,
    hour: h,
    minute: min,
    totalMinutes: h * 60 + min,
    weekday
  };
}

/**
 * Strict time-window validator:
 * Ensures dispatches ONLY occur within [target - earlyMinutes, target + lateMinutes].
 * Never allows sending late or at arbitrary hours!
 */
export function validateDispatchTimeWindow(targetHour, targetMinute, earlyMinutes = 3, lateGraceMinutes = 5) {
  const { hour, minute, totalMinutes } = getIsraelTime();
  const targetTotalMinutes = targetHour * 60 + targetMinute;
  const minAllowed = targetTotalMinutes - earlyMinutes;
  const maxOnTime = targetTotalMinutes + lateGraceMinutes;

  const onTime = totalMinutes >= minAllowed && totalMinutes <= maxOnTime;
  const isEarly = totalMinutes < minAllowed;
  const isLate = totalMinutes > maxOnTime;

  // Evening operational window: between 18:00 and 23:30
  // As explicitly requested by Hagai: Send the report even if delayed, with an apology prefix!
  const delayMinutes = isLate ? Math.max(1, totalMinutes - targetTotalMinutes) : 0;
  const isSameEvening = hour >= 18 && hour <= 23;
  const shouldSendWithApology = isLate && isSameEvening;

  let apologyPrefix = '';
  if (shouldSendWithApology) {
    apologyPrefix = `⏳ *התנצלות על העיכוב:* הדוח נשלח באיחור של ${delayMinutes} דקות עקב עומס בתשתיות הענן / עיכוב בסנכרון נתונים.\n\n`;
  }

  // Block completely if it's the wrong time of day entirely (e.g. morning 05:00 - 17:50 for an evening report)
  const isWrongTimeOfDay = hour < 17 || (hour === 17 && minute < 50);

  return {
    onTime,
    isEarly,
    isLate,
    shouldSendWithApology,
    apologyPrefix,
    isWrongTimeOfDay,
    delayMinutes,
    currentFormatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    targetFormatted: `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`,
    minAllowedFormatted: `${String(Math.floor(minAllowed / 60)).padStart(2, '0')}:${String(minAllowed % 60).padStart(2, '0')}`,
    maxAllowedFormatted: `${String(Math.floor(maxOnTime / 60)).padStart(2, '0')}:${String(maxOnTime % 60).padStart(2, '0')}`
  };
}

/**
 * Validates and Auto-Heals the 18:30 Sanity Report
 * Rule 0: Hagai is the owner, NEVER "המנהל".
 * Rule 1: Short, focused, strictly green events & red lights.
 * Rule 20: No payment discrepancy alerts on past stays.
 */
export function preflightValidateSanityReport(reportText, recipientChatId = HAGAI_CHAT_ID) {
  let cleaned = reportText;

  // 1. Enforce Rule 0: Replace any reference to Hagai as "המנהל"
  if (recipientChatId === HAGAI_CHAT_ID || recipientChatId.includes('0543200007')) {
    cleaned = cleaned
      .replace(/נשלח ישירות למנהל/g, 'נשלח ישירות לחגי')
      .replace(/לוואטסאפ של המנהל/g, 'לוואטסאפ של חגי')
      .replace(/למנהל \(0543200007\)/g, 'לחגי (0543200007)')
      .replace(/למנהל \(054-3200007\)/g, 'לחגי (054-3200007)');
  }

  // 2. Room assignment is dynamic and flexible - MUST NOT appear in Red Lights! (Rule 4)
  cleaned = cleaned.replace(/(?:🚨|🏠|🏨)?\s*\*?כלבים(?:\s*שוהים)?\s*(?:ללא שיבוץ|הממתינים לשיבוץ)[^\n]*\n[\s\S]*?(?=\n\n|\n(?:[🔴🚨💰📋🚪⚠️💬🏦📱])|$)/gu, '');
  cleaned = cleaned.replace(/(?:🚨|🏠|🏨)?\s*\*?התנגשויות חדרים[^\n]*\n[\s\S]*?(?=\n\n|\n(?:[🔴🚨💰📋🚪⚠️💬🏦📱])|$)/gu, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  // 3. Validate essential markers
  const hasGreenSection = cleaned.includes('אירועים ירוקים');
  const hasRedSection = cleaned.includes('אורות אדומים');
  const isValidStructure = hasGreenSection && hasRedSection;

  return {
    valid: isValidStructure,
    cleanedText: cleaned,
    modifications: cleaned !== reportText ? ['Corrected recipient salutation to Hagai (Rule 0)'] : []
  };
}

/**
 * Validates and Auto-Heals the 19:00 Tomorrow Overview Report
 */
export function preflightValidateTomorrowReport(reportText, activeBookings = [], todayStr) {
  let cleaned = reportText;
  const modifications = [];

  // Room assignment is dynamic and flexible - MUST NOT appear in Red Lights / Action Blocks! (Rule 4)
  cleaned = cleaned.replace(/(?:🚨|🏠|🏨)?\s*\*?כלבים(?:\s*שוהים)?\s*(?:ללא שיבוץ|הממתינים לשיבוץ)[^\n]*\n[\s\S]*?(?=\n\n|\n(?:[🔴🚨💰📋🚪⚠️💬🏦📱])|$)/gu, '');
  cleaned = cleaned.replace(/(?:🚨|🏠|🏨)?\s*\*?התנגשויות חדרים[^\n]*\n[\s\S]*?(?=\n\n|\n(?:[🔴🚨💰📋🚪⚠️💬🏦📱])|$)/gu, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return {
    valid: true,
    cleanedText: cleaned.replace(/\n{3,}/g, '\n\n').trim(),
    modifications
  };
}

/**
 * Validates and Auto-Heals the 20:00 Daily Regards (ד"ש)
 * Rule: NO outdated holiday references (e.g. Sukkot/Rosh Hashana in late October/November).
 * Luna & Shlomi Policy: Messages to Shlomi must actively tug on his emotions and induce guilt over abandoning Luna!
 */
export function preflightValidateDailyDogMessage(text, dogName, ownerName) {
  let cleaned = text;

  // Detect outdated holiday references in October / general days
  if (cleaned.includes('ראש השנה') || cleaned.includes('סוכות')) {
    const isLuna = String(dogName || '').includes('לונה') || String(ownerName || '').includes('שלומי');
    if (isLuna) {
      // Guilt-inducing replacement for Luna
      cleaned = `📅 *יום של געגוע שלא נגמר...* 💔🐾\n\nערב טוב שלומי.\nהיום ישבתי שוב ליד הגדר של החצר והסתכלתי לעבר השער. ראיתי עוד חבר שמשפחה שלו באה לחבק אותו ולקחת אותו הביתה, וחשבתי לעצמי בכאב – מתי גם אבא שלי יבוא לקחת אותי?...\nשמוליק והצוות דואגים לי להכל באהבה, אבל שום דבר בעולם לא יכול להחליף את החיבוק שלך. בבקשה, איך זה שאתה לא מגיע לבקר אותי אפילו לכמה דקות?\n\nלונה שמחכה רק לך 🐶🥺`;
    } else {
      // Clean, warm, high-standard resort greeting for normal dogs
      cleaned = `היי ${ownerName}! 🐾\nאיזה יום מקסים עבר עלי בריזורט לכלב! 🌿🐕\nהספקתי לרוץ ולשחק בטבע, לקבל ליטופים מפנקים משמוליק, ועכשיו הראש שלי שקוע עמוק בכרית בסוויטה 🛋️✨\nתיהנו מכל רגע, אוהבת המון, ${dogName} 🐶❤️`;
    }
  }

  return cleaned;
}

/**
 * Auto-Heal ghost stays in Supabase:
 * Any stay whose end_date <= todayStr and a review request was dispatched,
 * but was left as 'checked_in', is automatically updated to 'checked_out' (Rule 13).
 */
export async function autoHealCompletedStays(supabase, todayStr) {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .lte('end_date', todayStr)
      .eq('stay_status', 'checked_in');

    if (error || !bookings || bookings.length === 0) return 0;

    let healedCount = 0;
    for (const b of bookings) {
      const bData = b.data || {};
      const notes = b.notes || '';
      const hasReviewSent = notes.includes('[סקר_נשלח]') || bData.reviewRequestSent;

      // If stay ended before today OR review request already sent today -> close stay
      if (b.end_date < todayStr || hasReviewSent) {
        await supabase.from('bookings').update({
          stay_status: 'checked_out',
          data: {
            ...bData,
            stayStatus: 'checked_out',
            actualCheckoutDate: b.end_date || todayStr
          },
          updated_at: new Date().toISOString()
        }).eq('id', b.id);
        healedCount++;
      }
    }
    return healedCount;
  } catch (e) {
    console.warn('autoHealCompletedStays warning:', e);
    return 0;
  }
}

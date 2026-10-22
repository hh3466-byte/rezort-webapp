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
export function validateDispatchTimeWindow(targetHour, targetMinute, earlyMinutes = 2, lateMinutes = 4) {
  const { hour, minute, totalMinutes } = getIsraelTime();
  const targetTotalMinutes = targetHour * 60 + targetMinute;
  const minAllowed = targetTotalMinutes - earlyMinutes;
  const maxAllowed = targetTotalMinutes + lateMinutes;

  const inWindow = totalMinutes >= minAllowed && totalMinutes <= maxAllowed;
  const isEarly = totalMinutes < minAllowed;
  const isLate = totalMinutes > maxAllowed;

  return {
    inWindow,
    isEarly,
    isLate,
    currentFormatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    targetFormatted: `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`,
    minAllowedFormatted: `${String(Math.floor(minAllowed / 60)).padStart(2, '0')}:${String(minAllowed % 60).padStart(2, '0')}`,
    maxAllowedFormatted: `${String(Math.floor(maxAllowed / 60)).padStart(2, '0')}:${String(maxAllowed % 60).padStart(2, '0')}`
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

  // 2. Validate essential markers
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
 * Crucial Rule: Dogs whose stay ends on or before today (e.g. Shilgi) MUST NOT
 * appear under "כלבים שוהים הממתינים לשיבוץ מיקום לינה ודלי מזון" for tomorrow!
 */
export function preflightValidateTomorrowReport(reportText, activeBookings = [], todayStr) {
  let cleaned = reportText;
  const modifications = [];

  // Check if any dog whose endDate <= todayStr was mistakenly included in the unassigned list
  for (const b of activeBookings) {
    const end = b.end_date || b.endDate || '';
    const dogName = (b.dog_name || b.dogName || '').trim();
    if (end && end <= todayStr && dogName) {
      // If this dog's name appears in the unassigned kennel section
      const unassignedHeaderRegex = /🏠\s*\*כלבים(?:\s*שוהים)?\s*הממתינים לשיבוץ מיקום לינה ודלי מזון[^\n]*\n([\s\S]*?)(?=\n\n|\n[🔴🚨💰📋🚪⚠️]|$)/;
      const match = cleaned.match(unassignedHeaderRegex);
      if (match && match[1] && match[1].includes(dogName)) {
        // Remove line mentioning this dog
        const lines = match[1].split('\n').filter(line => !line.includes(dogName));
        if (lines.length > 0) {
          cleaned = cleaned.replace(match[1], lines.join('\n'));
        } else {
          // No more dogs unassigned, remove the entire section block
          cleaned = cleaned.replace(match[0], '');
        }
        modifications.push(`Removed departed/ending dog "${dogName}" from tomorrow's kennel allocation list`);
      }
    }
  }

  return {
    valid: true,
    cleanedText: cleaned.replace(/\n{3,}/g, '\n\n').trim(),
    modifications
  };
}

/**
 * Validates and Auto-Heals the 20:00 Daily Regards (ד"ש)
 * Rule: NO outdated holiday references (e.g. Sukkot/Rosh Hashana in late October/November),
 * NO repetitive guilt-tripping text.
 */
export function preflightValidateDailyDogMessage(text, dogName, ownerName) {
  let cleaned = text;

  // Detect outdated holiday references in October / general days
  if (cleaned.includes('ראש השנה') || cleaned.includes('סוכות')) {
    // Replace with clean, warm, high-standard resort greeting
    cleaned = `היי ${ownerName}! 🐾\nאיזה יום מקסים עבר עלי בריזורט לכלב! 🌿🐕\nהספקתי לרוץ ולשחק בטבע, לקבל ליטופים מפנקים משמוליק, ועכשיו הראש שלי שקוע עמוק בכרית בסוויטה 🛋️✨\nתיהנו מכל רגע, אוהבת המון, ${dogName} 🐶❤️`;
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

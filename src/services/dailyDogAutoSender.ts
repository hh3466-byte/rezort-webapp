import { Booking, ResortSettings, IntakeRequest } from '../types';
import { getTodayStr, addDays } from '../utils/dateUtils';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from './notificationService';
import { saveBookingToDb } from './dbService';
import { 
  pickDailyDogTemplate, 
  isDogIsolationRequired, 
  isDogInTraining 
} from '../data/dailyDogTemplates';
import { isCustomerMessagingRestrictedNow } from '../utils/jewishCalendar';

let autoSenderInterval: any = null;
let isSendingInProgress = false;

/**
 * Builds the comprehensive end-of-evening summary report for the Manager (054-3200007),
 * combining the 20:00 Dog Regards delivery status with the 19:00 VIP Review & Voucher dispatch details.
 */
function buildEveningManagerSummaryMessage(
  sentRegardsCount: number,
  regardsErrors: string[],
  bookings: Booking[],
  todayStr: string
): string {
  const regardsStatus = regardsErrors.length === 0 ? 'אין כשל' : `יש כשל (${regardsErrors.length} שגיאות)`;
  const regardsLine = `• *עדכוני ד"ש (20:00):* נשלחו ד"ש לכול בעלי הכלבים סה"כ ${sentRegardsCount} הודעות כולם קיבלו. ${regardsStatus}`;

  // Analyze 19:00 VIP Review Requests & Vouchers strictly for today's departures (or weekend departures on Motzei Shabbat)
  const now = new Date();
  const isSat = now.getDay() === 6;
  const weekendStartStr = addDays(todayStr, -2);

  const recentDepartures = bookings.filter(b => {
    if (b.stayStatus === 'cancelled' || b.stayStatus === 'archived' || (b as any).stay_status === 'archived') return false;
    const end = b.endDate;
    if (isSat) {
      return end >= weekendStartStr && end <= todayStr;
    }
    return end === todayStr;
  });

  const sentReviews = recentDepartures.filter(b => {
    const notes = b.notes || '';
    const localVal = typeof window !== 'undefined' ? localStorage.getItem(`review_request_sent_${b.id}`) : null;
    return notes.includes('[סקר_נשלח]') || localVal === 'already_sent' || (typeof localVal === 'string' && localVal.includes(todayStr));
  });

  const skippedReviews = recentDepartures.filter(b => {
    const notes = b.notes || '';
    return b.skipReviewRequest === true || notes.includes('ללא_סקר') || notes.includes('[ללא_סקר]');
  });

  let reviewLine = '';
  if (sentReviews.length > 0) {
    const clientList = sentReviews.map(b => `${b.dogName || 'כלב'} (${b.ownerName || 'בעלים'})`).join(', ');
    reviewLine = `• *בקשות חוות דעת ומועדון VIP:* נשלחו בקשות חוות דעת ומועדון VIP סה"כ ${sentReviews.length} הודעות והאירוע הסתיים בהצלחה (${clientList}). אין כשל`;
  } else {
    if (isSat && (now.getHours() < 20 || (now.getHours() === 20 && now.getMinutes() < 15))) {
      reviewLine = `• *בקשות חוות דעת ומועדון VIP:* מתוזמנות למוצאי שבת (20:15). טרם שוגרו.`;
    } else {
      reviewLine = `• *בקשות חוות דעת ומועדון VIP:* נשלחו סה"כ 0 הודעות (לא היו שחרורים מתאימים) והאירוע הסתיים בהצלחה. אין כשל`;
    }
  }

  let skippedLine = '';
  if (skippedReviews.length > 0) {
    const skipList = skippedReviews.map(b => `${b.dogName || 'כלב'} (${b.ownerName || 'בעלים'})`).join(', ');
    skippedLine = `\n(בוטלה שליחה יזומה ל-${skippedReviews.length} לקוחות לפי סימון שמוליק: ${skipList})`;
  }

  const errorsSection = regardsErrors.length > 0 ? `\n\n⚠️ פירוט תקלות:\n• ${regardsErrors.join('\n• ')}` : '';

  return `🐾 *עדכון סיכום משלוחי ערב – הריזורט לכלב*\n\n${regardsLine}\n${reviewLine}${skippedLine}${errorsSection}`;
}

/**
 * Checks if current time in Israel is eligible for evening updates / weekend greetings:
 * 1. On Friday from 14:00 and throughout Shabbat/Chag until 40m after Havdalah: strictly NOT eligible.
 * 2. On Saturday (or Chag) starting at Havdalah + 40 minutes (until 23:30): ELIGIBLE!
 * 3. On regular weekdays (Sun-Thu) between 20:00 and 22:59: ELIGIBLE.
 */
export function isEveningUpdateEligibleNow(): { eligible: boolean; reason?: string } {
  const now = new Date();
  const restriction = isCustomerMessagingRestrictedNow(now);

  if (restriction.isRestricted) {
    return { eligible: false, reason: restriction.reason };
  }

  // Motzei Shabbat / Motzei Chag window: reached 40 minutes after Havdalah!
  if (restriction.isMotzeiShabbatEligibleNow) {
    return { eligible: true };
  }

  // Regular business days (Sunday - Thursday):
  // Evening window: 20:00 - 20:30 strictly
  const israelTz = 'Asia/Jerusalem';
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: israelTz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = dtf.formatToParts(now);
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }

  const isEveningWindow = (hour === 20 && minute <= 30);

  if (!isEveningWindow) {
    if (hour > 20 || (hour === 20 && minute > 30)) {
      return { eligible: false, reason: `מאוחר מדי (לאחר 20:30) – חלון שליחת ד״ש ערב הסתיים להיום` };
    }
    return { eligible: false, reason: `מחוץ לשעות השליחה (השעה הנוכחית: ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}, שעות מורשות: 20:00-20:30 בלבד)` };
  }

  return { eligible: true };
}

/**
 * Executes automatic sending of 20:00 evening updates for all unsent dogs staying tonight.
 * Enforces strict separation between Training (אילוף) and Boarding (פנסיון)!
 */
export async function runAutoDailyDogUpdates(
  bookings: Booking[],
  settings: ResortSettings,
  intakeRequests: IntakeRequest[],
  showToast?: (msg: string) => void
): Promise<{ sentCount: number; errors: string[] }> {
  if (isSendingInProgress) {
    return { sentCount: 0, errors: ['שליחה קודמת עדיין מתבצעת'] };
  }

  const eligibility = isEveningUpdateEligibleNow();
  if (!eligibility.eligible) {
    return { sentCount: 0, errors: [eligibility.reason || 'לא זמין כעת לשליחה'] };
  }

  const greenApiId = settings.greenApiIdInstance?.trim();
  const greenApiToken = settings.greenApiToken?.trim();

  if (!greenApiId || !greenApiToken) {
    console.warn('[AutoSender] Green-API credentials missing in settings');
    return { sentCount: 0, errors: ['חסרים פרטי חיבור ל-Green-API בהגדרות'] };
  }

  const todayStr = getTodayStr();

  // Filter dogs active tonight and deduplicate by phone + dog name to avoid duplicate sends if duplicate bookings exist
  const seenDogsMap = new Set<string>();
  const activeTonightUnique = bookings.filter(b => {
    if (b.stayStatus === 'cancelled') return false;
    const isStaying = b.startDate <= todayStr && b.endDate > todayStr;
    if (!isStaying) return false;
    
    const phone = cleanPhoneNumber(b.ownerPhone);
    const dog = (b.dogName || '').trim().toLowerCase();
    const dogKey = `${phone}_${dog}`;
    if (seenDogsMap.has(dogKey)) return false;
    seenDogsMap.add(dogKey);
    return true;
  });

  if (activeTonightUnique.length === 0) {
    return { sentCount: 0, errors: [] };
  }

  // Filter unsent dogs (Check BOTH local device storage AND shared Supabase database)
  const unsentDogs = activeTonightUnique.filter(b => {
    const key = `daily_dog_sent_${b.id}_${todayStr}`;
    const dogPhoneKey = `daily_dog_sent_${cleanPhoneNumber(b.ownerPhone)}_${(b.dogName || '').trim().toLowerCase()}_${todayStr}`;
    const sentLocally = localStorage.getItem(key) === 'true' || localStorage.getItem(dogPhoneKey) === 'true';
    const sentInDb = b.lastDailyDogUpdateSent === todayStr || (b as any)?.data?.lastDailyDogUpdateSent === todayStr;
    return !sentLocally && !sentInDb;
  });

  if (unsentDogs.length === 0) {
    return { sentCount: 0, errors: [] };
  }

  isSendingInProgress = true;
  let sentCount = 0;
  const errors: string[] = [];

  console.log(`[AutoSender 20:00] מתחיל משלוח אוטומטי ל-${unsentDogs.length} כלבים שטרם עודכנו...`);

  // Group dogs by owner phone to send ONE combined evening update for dog pairs/families
  const ownerGroups = new Map<string, Booking[]>();
  for (const b of unsentDogs) {
    const cleanPhone = cleanPhoneNumber(b.ownerPhone);
    if (!cleanPhone || cleanPhone.length < 9) continue;
    if (!ownerGroups.has(cleanPhone)) {
      ownerGroups.set(cleanPhone, []);
    }
    ownerGroups.get(cleanPhone)!.push(b);
  }

  for (const [cleanPhone, dogGroup] of ownerGroups.entries()) {
    const firstB = dogGroup[0];
    const ownerName = firstB.ownerName || 'בעלים יקר';

    // Combine all unique dog names for this owner
    const uniqueDogNames = Array.from(new Set(dogGroup.map(b => (b.dogName || '').trim()).filter(Boolean)));
    const combinedDogName = uniqueDogNames.length > 1 
      ? uniqueDogNames.slice(0, -1).join(', ') + ' ו' + uniqueDogNames[uniqueDogNames.length - 1]
      : (uniqueDogNames[0] || 'הכלב');

    // Cross reference intake for friendly/isolation status
    const intakeMatch = intakeRequests.find(r => {
      const reqPhone = cleanPhoneNumber(r.ownerPhone);
      return reqPhone.slice(-7) === cleanPhone.slice(-7);
    });

    const isTraining = dogGroup.some(b => isDogInTraining(
      b.serviceType,
      b.notes,
      b.behaviorNotes,
      intakeMatch?.serviceType
    ));

    const isIsolation = dogGroup.some(b => isDogIsolationRequired(
      b.notes,
      b.behaviorNotes,
      b.dailyRate,
      intakeMatch?.isFriendlyWithDogs
    ));

    const isFemale = dogGroup.some(b => Boolean(
      b.dogGender === 'female_spayed' || 
      b.dogGender === 'female_intact' ||
      (intakeMatch?.dogGender as string) === 'female' ||
      (intakeMatch?.dogGender as string) === 'female_spayed' ||
      (intakeMatch?.dogGender as string) === 'female_intact' ||
      (b.notes && (b.notes.includes('נקבה') || b.notes.includes('מעוקרת'))) ||
      (b.behaviorNotes && (b.behaviorNotes.includes('נקבה') || b.behaviorNotes.includes('מעוקרת'))) ||
      ['לונה', 'קירה', 'מימי', 'ניצה', 'גולי', 'ג\'ולי', 'נולי', 'שירלי', 'מיה', 'בלה', 'בל', 'רובי', 'ג\'סי', 'גסי', 'מרתה', 'לוסי', 'לולה', 'ג\'וזי'].some(fn => (b.dogName || '').includes(fn)) ||
      (b.dogName || '').includes('ית')
    ));

    const minStartDate = dogGroup.map(b => b.startDate).filter(Boolean).sort()[0] || firstB.startDate;

    const { formattedText } = pickDailyDogTemplate(
      ownerName,
      combinedDogName,
      isIsolation,
      [],
      isTraining,
      isFemale,
      minStartDate,
      cleanPhone
    );

    try {
      const res = await sendGreenApiDirectMessage(cleanPhone, formattedText, greenApiId, greenApiToken);
      if (res.success) {
        // Mark ALL dogs in this group as sent today in localStorage & DB
        for (const b of dogGroup) {
          localStorage.setItem(`daily_dog_sent_${b.id}_${todayStr}`, 'true');
          localStorage.setItem(`daily_dog_sent_${cleanPhone}_${(b.dogName || '').trim().toLowerCase()}_${todayStr}`, 'true');
          try {
            const updatedBooking: Booking = {
              ...b,
              lastDailyDogUpdateSent: todayStr
            };
            await saveBookingToDb(updatedBooking);
          } catch (errDb) {
            console.warn('[AutoSender] Failed to sync update state to DB:', errDb);
          }
        }
        sentCount += dogGroup.length;
        console.log(`[AutoSender 20:00] נשלח בהצלחה ל-${combinedDogName} (${ownerName}) [אילוף=${isTraining}, בידוד=${isIsolation}]`);
      } else {
        errors.push(`שגיאה במשלוח ל-${combinedDogName}: ${res.error || 'נכשל'}`);
      }
    } catch (e: any) {
      errors.push(`שגיאה במשלוח ל-${combinedDogName}: ${e.message || String(e)}`);
    }

    // Interval to protect API limits
    await new Promise(res => setTimeout(res, 1400));
  }

  isSendingInProgress = false;

  // Send summary confirmation to Manager (054-3200007)
  const adminPhone = '0543200007';
  const adminKey = `daily_dog_admin_notified_${todayStr}`;
  const alreadyNotifiedAdmin = typeof window !== 'undefined' && localStorage.getItem(adminKey) === 'true';

  if (sentCount > 0 && !alreadyNotifiedAdmin) {
    const adminSummaryMsg = buildEveningManagerSummaryMessage(sentCount, errors, bookings, todayStr);
    try {
      await sendGreenApiDirectMessage(adminPhone, adminSummaryMsg, greenApiId, greenApiToken, { skipHolidayCheck: true });
      if (typeof window !== 'undefined') {
        localStorage.setItem(adminKey, 'true');
      }
      console.log(`[AutoSender 20:00] אישור נשלח בהצלחה למנהל (${adminPhone})`);
    } catch (errAdmin) {
      console.warn('[AutoSender 20:00] שגיאה בשליחת עדכון למנהל:', errAdmin);
    }
  }

  if (sentCount > 0 && showToast) {
    showToast(`🚀 שליחה אוטומטית (20:00): נשלחו ${sentCount} עדכוני ערב יומיים לכלבים השוהים! 🐾✨`);
  }

  return { sentCount, errors };
}

/**
 * Initializes the background watcher that checks every 60 seconds
 */
export function initDailyDogAutoSender(
  getBookings: () => Booking[],
  getSettings: () => ResortSettings,
  getIntakeRequests: () => IntakeRequest[],
  showToast?: (msg: string) => void
): () => void {
  if (autoSenderInterval) {
    clearInterval(autoSenderInterval);
  }

  const checkAndRun = () => {
    const eligibility = isEveningUpdateEligibleNow();
    if (eligibility.eligible) {
      runAutoDailyDogUpdates(getBookings(), getSettings(), getIntakeRequests(), showToast).catch(err => {
        console.error('[AutoSender Error]:', err);
      });
    }
  };

  // Run initial check after short delay
  const initialTimer = setTimeout(checkAndRun, 4000);

  // Check every 60 seconds
  autoSenderInterval = setInterval(checkAndRun, 60000);

  return () => {
    clearTimeout(initialTimer);
    if (autoSenderInterval) {
      clearInterval(autoSenderInterval);
      autoSenderInterval = null;
    }
  };
}

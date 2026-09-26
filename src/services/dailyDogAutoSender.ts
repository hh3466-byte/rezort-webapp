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

  // Analyze 19:00 VIP Review Requests & Vouchers
  const yesterdayStr = addDays(todayStr, -1);
  const fourDaysAgoStr = addDays(todayStr, -4);

  const recentDepartures = bookings.filter(b => {
    if (b.stayStatus === 'cancelled') return false;
    const end = b.endDate;
    return end >= fourDaysAgoStr && end <= todayStr;
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
    reviewLine = `• *בקשות חוות דעת ומועדון VIP (19:00):* נשלחו בקשות חוות דעת ומועדון VIP סה"כ ${sentReviews.length} הודעות והאירוע הסתיים בהצלחה (${clientList}). אין כשל`;
  } else {
    reviewLine = `• *בקשות חוות דעת ומועדון VIP (19:00):* נשלחו סה"כ 0 הודעות (לא היו שחרורים מתאימים היום) והאירוע הסתיים בהצלחה. אין כשל`;
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

  // Regular business days (Sunday - Thursday): window is 20:00 - 22:59
  const israelTz = 'Asia/Jerusalem';
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: israelTz,
    hour: 'numeric',
    hour12: false
  });
  const hour = parseInt(dtf.format(now), 10);

  if (hour < 20 || hour >= 23) {
    return { eligible: false, reason: `מחוץ לשעות השליחה (השעה הנוכחית: ${hour}:00, חלון השליחה הרגיל: 20:00-23:00)` };
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

  const processedDogsInBatch = new Set<string>();

  for (const b of unsentDogs) {
    const cleanPhone = cleanPhoneNumber(b.ownerPhone);
    if (!cleanPhone || cleanPhone.length < 9) continue;
    const dogDedupKey = `${cleanPhone}_${(b.dogName || '').trim().toLowerCase()}`;
    if (processedDogsInBatch.has(dogDedupKey)) continue;
    processedDogsInBatch.add(dogDedupKey);

    // Cross reference intake for friendly/isolation status
    const intakeMatch = intakeRequests.find(r => {
      const reqPhone = cleanPhoneNumber(r.ownerPhone);
      return reqPhone.slice(-7) === cleanPhone.slice(-7);
    });

    const isTraining = isDogInTraining(
      b.serviceType,
      b.notes,
      b.behaviorNotes,
      intakeMatch?.serviceType
    );

    const isIsolation = isDogIsolationRequired(
      b.notes,
      b.behaviorNotes,
      b.dailyRate,
      intakeMatch?.isFriendlyWithDogs
    );

    const { formattedText } = pickDailyDogTemplate(
      b.ownerName,
      b.dogName,
      isIsolation,
      [],
      isTraining
    );

    try {
      const res = await sendGreenApiDirectMessage(cleanPhone, formattedText, greenApiId, greenApiToken);
      if (res.success) {
        localStorage.setItem(`daily_dog_sent_${b.id}_${todayStr}`, 'true');
        localStorage.setItem(`daily_dog_sent_${cleanPhone}_${(b.dogName || '').trim().toLowerCase()}_${todayStr}`, 'true');
        // Persist to Supabase so NO other device or browser ever re-sends today!
        try {
          const updatedBooking: Booking = {
            ...b,
            lastDailyDogUpdateSent: todayStr
          };
          await saveBookingToDb(updatedBooking);
        } catch (errDb) {
          console.warn('[AutoSender] Failed to sync update state to DB:', errDb);
        }
        sentCount++;
        console.log(`[AutoSender 20:00] נשלח בהצלחה ל-${b.dogName} (${b.ownerName}) [אילוף=${isTraining}, בידוד=${isIsolation}]`);
      } else {
        errors.push(`שגיאה במשלוח ל-${b.dogName}: ${res.error || 'נכשל'}`);
      }
    } catch (e: any) {
      errors.push(`שגיאה במשלוח ל-${b.dogName}: ${e.message || String(e)}`);
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

import { Booking, ResortSettings, IntakeRequest } from '../types';
import { getTodayStr } from '../utils/dateUtils';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from './notificationService';
import { saveBookingToDb } from './dbService';
import { 
  pickDailyDogTemplate, 
  isDogIsolationRequired, 
  isDogInTraining 
} from '../data/dailyDogTemplates';
import { isYomKippurActiveNow } from '../utils/jewishCalendar';

let autoSenderInterval: any = null;
let isSendingInProgress = false;

/**
 * Checks if current time in Israel is within the evening window (20:00 to 22:59)
 * and verifies it is not Friday night (ערב שבת) or Yom Kippur.
 */
export function isEveningUpdateEligibleNow(): { eligible: boolean; reason?: string } {
  if (isYomKippurActiveNow()) {
    return { eligible: false, reason: 'יום כיפור חל כעת - שקט מוחלט' };
  }

  const now = new Date();
  const israelTz = 'Asia/Jerusalem';

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: israelTz,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false
  });

  const parts = dtf.formatToParts(now);
  let hour = 0;
  let weekday = '';

  for (const p of parts) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
  }

  // Friday night (ערב שבת) -> no messages sent
  if (weekday === 'Fri') {
    return { eligible: false, reason: 'ערב שבת (יום שישי) - שקט מוחלט' };
  }

  // Eligible only between 20:00 and 22:59
  if (hour < 20 || hour >= 23) {
    return { eligible: false, reason: `מחוץ לשעות השליחה (השעה הנוכחית: ${hour}:00, חלון השליחה: 20:00-23:00)` };
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

  // Filter dogs active tonight
  const activeTonight = bookings.filter(b => {
    if (b.stayStatus === 'cancelled') return false;
    return b.startDate <= todayStr && b.endDate > todayStr;
  });

  if (activeTonight.length === 0) {
    return { sentCount: 0, errors: [] };
  }

  // Filter unsent dogs (Check BOTH local device storage AND shared Supabase database)
  const unsentDogs = activeTonight.filter(b => {
    const key = `daily_dog_sent_${b.id}_${todayStr}`;
    const sentLocally = localStorage.getItem(key) === 'true';
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

  for (const b of unsentDogs) {
    const cleanPhone = cleanPhoneNumber(b.ownerPhone);
    if (!cleanPhone || cleanPhone.length < 9) continue;

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

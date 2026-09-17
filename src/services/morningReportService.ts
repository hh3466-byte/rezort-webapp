import { Booking, ResortSettings, IntakeRequest } from '../types';
import { getTodayStr, getDayNameHebrew, formatDateIL } from '../utils/dateUtils';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from './notificationService';
import { isShabbatOrHolidayRestricted } from '../utils/jewishCalendar';
import { fetchNewCrmChatsCount } from './whatsappCrmService';
import { isIntakeRequestNew } from '../utils/intakeUtils';

let morningReportInterval: any = null;
let isMorningSending = false;

/**
 * Format Shmulik's daily 07:30 AM morning report
 */
export function formatMorningReport(
  managerName: string,
  pendingIntakesCount: number,
  newCrmLeadsCount: number,
  presentDogsCount: number,
  checkinsToday: number,
  checkoutsToday: number,
  dateStr: string = getTodayStr()
): string {
  const dayName = getDayNameHebrew(dateStr);
  const formattedDate = formatDateIL(dateStr);
  const cleanManager = managerName && managerName !== 'מנהל' ? managerName : 'שמוליק';

  return `🌅 *בוקר טוב ${cleanManager}! דוח בוקר יומי – הריזורט לכלב* 🐾
📅 יום ${dayName}, ${formattedDate} | שעה 07:30

📋 *משימות ומעקב להיום:*
• 📥 *שאלונים לבדיקה:* ${pendingIntakesCount} ${pendingIntakesCount === 1 ? 'שאלון חדש ממתין לבדיקה' : 'שאלונים ממתינים לבדיקה'}
• 💬 *פניות חדשות בוואטסאפ:* ${newCrmLeadsCount} פניות טרם נענו

🐕 *תמונת מצב בריזורט היום:*
• 🏠 *כלבים נוכחים בריזורט:* ${presentDogsCount} כלבים
• 🟢 *כניסות היום (Check-in):* ${checkinsToday}
• 🔴 *יציאות היום (Check-out):* ${checkoutsToday}

שיהיה יום מוצלח, רגוע ופורה עם הכלבים! ❤️🐶`;
}

/**
 * Checks if current time in Israel is >= 07:30 AM and not during Shabbat / Yom Tov moratorium
 */
export function isMorningReportEligibleNow(now: Date = new Date()): { eligible: boolean; reason?: string } {
  // Shabbat & Holiday restriction check
  const holidayCheck = isShabbatOrHolidayRestricted(now);
  if (holidayCheck.isRestricted) {
    return { eligible: false, reason: holidayCheck.reason };
  }

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false
  });

  const parts = dtf.formatToParts(now);
  let hour = 0;
  let minute = 0;

  for (const p of parts) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }

  // Trigger window: starting at 07:30 AM up to 11:30 AM
  const totalMinutes = hour * 60 + minute;
  const target730Minutes = 7 * 60 + 30; // 450 minutes
  const endWindowMinutes = 12 * 60;     // 720 minutes

  if (totalMinutes < target730Minutes) {
    return { eligible: false, reason: `מוקדם מדי (השעה ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}, דוח הבוקר מתוזמן ל-07:30)` };
  }

  if (totalMinutes >= endWindowMinutes) {
    return { eligible: false, reason: `חלון דוח הבוקר נסגר להיום (השעה הנוכחית: ${hour}:${minute})` };
  }

  return { eligible: true };
}

/**
 * Sends the 07:30 Morning Report to Shmulik via Green-API and returns results
 */
export async function sendMorningReportToShmulik(
  bookings: Booking[],
  settings: ResortSettings,
  intakeRequests: IntakeRequest[],
  options?: { force?: boolean }
): Promise<{ success: boolean; message?: string; error?: string }> {
  const today = getTodayStr();
  const storageKey = `shmulik_morning_report_${today}`;

  if (!options?.force) {
    if (localStorage.getItem(storageKey)) {
      return { success: false, error: `דוח הבוקר של היום (${today}) כבר נשלח בעבר.` };
    }

    const check = isMorningReportEligibleNow();
    if (!check.eligible) {
      return { success: false, error: check.reason };
    }
  }

  // Calculate statistics
  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');
  const presentDogsCount = activeBookings.filter(b => b.startDate <= today && b.endDate >= today).length;
  const checkinsToday = activeBookings.filter(b => b.startDate === today).length;
  const checkoutsToday = activeBookings.filter(b => b.endDate === today).length;

  const pendingIntakesCount = intakeRequests.filter(r => isIntakeRequestNew(r, bookings)).length;

  let newCrmLeadsCount = 0;
  try {
    newCrmLeadsCount = await fetchNewCrmChatsCount(settings, bookings, intakeRequests);
  } catch {}

  const managerPhone = cleanPhoneNumber(settings?.whatsappNotificationPhone || settings?.managerPhone || '0506816001');
  const reportText = formatMorningReport(
    settings?.managerName || 'שמוליק',
    pendingIntakesCount,
    newCrmLeadsCount,
    presentDogsCount,
    checkinsToday,
    checkoutsToday,
    today
  );

  const res = await sendGreenApiDirectMessage(
    managerPhone,
    reportText,
    settings?.greenApiIdInstance,
    settings?.greenApiToken,
    { skipHolidayCheck: options?.force }
  );

  if (res.success) {
    localStorage.setItem(storageKey, new Date().toISOString());
    return { success: true, message: `דוח הבוקר נשלח בהצלחה לוואטסאפ של שמוליק (${managerPhone})!` };
  } else {
    return { success: false, error: res.error || 'שגיאה בשליחת דוח הבוקר ב-Green-API' };
  }
}

/**
 * Initializes the background 07:30 morning scheduler in the web app
 */
export function initMorningReportScheduler(
  getBookings: () => Booking[],
  getSettings: () => ResortSettings,
  getIntakeRequests: () => IntakeRequest[],
  showToast?: (msg: string) => void
): () => void {
  if (morningReportInterval) {
    clearInterval(morningReportInterval);
  }

  const checkAndRun = async () => {
    if (isMorningSending) return;
    const today = getTodayStr();
    const storageKey = `shmulik_morning_report_${today}`;
    if (localStorage.getItem(storageKey)) return;

    const eligibility = isMorningReportEligibleNow();
    if (!eligibility.eligible) return;

    isMorningSending = true;
    try {
      const res = await sendMorningReportToShmulik(
        getBookings(),
        getSettings(),
        getIntakeRequests()
      );

      if (res.success) {
        showToast?.('🌅 דוח בוקר (07:30) נשלח לוואטסאפ של שמוליק! 🐾');
        // Native browser notification if permitted
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('🌅 דוח בוקר יומי – הריזורט לכלב', {
              body: 'השעה 07:30! דוח הבוקר עם סטטוס השאלונים, הפניות והכלבים נשלח לשמוליק.',
              icon: '/favicon.ico'
            });
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Morning report scheduler error:', e);
    } finally {
      isMorningSending = false;
    }
  };

  // Run on mount then check every 30 seconds
  checkAndRun();
  morningReportInterval = setInterval(checkAndRun, 30000);

  return () => {
    if (morningReportInterval) {
      clearInterval(morningReportInterval);
      morningReportInterval = null;
    }
  };
}

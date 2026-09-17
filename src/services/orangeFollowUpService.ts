import { Booking, ResortSettings, IntakeRequest } from '../types';
import { getTodayStr, formatDateIL } from '../utils/dateUtils';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { isShabbatOrHolidayRestricted } from '../utils/jewishCalendar';
import { generateUnansweredFollowUpMarketingText, sendGreenApiChatMessage } from './whatsappCrmService';
import { isIntakeRequestInTreatment } from '../utils/intakeUtils';
import { saveIntakeRequestToDb } from './dbService';

let orangeFollowUpInterval: any = null;
let isFollowUpRunning = false;

/**
 * Checks if current time in Israel is >= 08:30 AM (and before 14:00 on Friday)
 * and not during Shabbat / Yom Tov moratorium
 */
export function isOrangeFollowUpEligibleNow(now: Date = new Date()): { eligible: boolean; reason?: string } {
  // Strict Shabbat & Holiday restriction check (Blocks Friday after 14:00 and all Saturday)
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
  let weekday = '';

  for (const p of parts) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
  }

  // Eligible window: 08:30 AM onwards.
  // On Friday (Fri), must be before 14:00 (Shabbat eve cutoff)
  const totalMinutes = hour * 60 + minute;
  const isAfter0830 = totalMinutes >= (8 * 60 + 30); // 08:30

  if (!isAfter0830) {
    return { eligible: false, reason: 'השעה טרם הגיעה ל-08:30 בבוקר' };
  }

  if (weekday === 'Fri' && hour >= 14) {
    return { eligible: false, reason: 'יום שישי לאחר 14:00 - נעילת שבת' };
  }

  return { eligible: true };
}

export interface OrangeFollowUpResult {
  candidateCount: number;
  sentCount: number;
  results: Array<{
    dogName: string;
    ownerName: string;
    ownerPhone: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Sends the marketing follow-up to all in-progress intake requests in the orange button
 * that have not yet received the marketing reminder.
 * Immediately tags them as unanswered so they move out of the active queue to the archived list!
 */
export async function sendOrangeFollowUpBatch(
  bookings: Booking[],
  settings: ResortSettings,
  intakeRequests: IntakeRequest[],
  options?: { force?: boolean }
): Promise<OrangeFollowUpResult> {
  const eligible = options?.force ? { eligible: true } : isOrangeFollowUpEligibleNow();
  if (!eligible.eligible) {
    console.log(`[Orange Follow-Up] Skipped: ${eligible.reason}`);
    return { candidateCount: 0, sentCount: 0, results: [] };
  }

  // 1. Find all candidates in the orange button (in_progress)
  const candidates = intakeRequests.filter(r => {
    // Must be in treatment
    if (!isIntakeRequestInTreatment(r, bookings)) return false;
    // Must not have already received the marketing follow-up
    const notes = r.internalNotes || '';
    if (notes.includes('תזכורת שיווקית') || notes.includes('הודעת שיווק')) return false;
    return true;
  });

  console.log(`[Orange Follow-Up] Found ${candidates.length} candidate(s) in orange button`);
  const results: OrangeFollowUpResult['results'] = [];
  let sentCount = 0;

  const intakeUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?intake=true`
    : 'https://rezort-webapp.vercel.app/?intake=true';

  for (const req of candidates) {
    const phone = cleanPhoneNumber(req.ownerPhone);
    if (!phone) {
      results.push({
        dogName: req.dogName,
        ownerName: req.ownerName,
        ownerPhone: req.ownerPhone,
        success: false,
        error: 'מספר טלפון לא תקין'
      });
      continue;
    }

    const marketingText = generateUnansweredFollowUpMarketingText(
      req.ownerName,
      req.dogName,
      req.serviceType,
      intakeUrl
    );

    const chatId = `${phone}@c.us`;

    try {
      await sendGreenApiChatMessage(chatId, marketingText, settings, { skipHolidayCheck: options?.force });

      // Format timestamp in Israel time
      const nowIL = new Date();
      const timeStr = `${String(nowIL.getDate()).padStart(2, '0')}/${String(nowIL.getMonth() + 1).padStart(2, '0')} 08:30`;
      const updateStamp = `[${timeStr}] 📲 נשלחה תזכורת שיווקית בוואטסאפ (לא ענה - מתוזמן 08:30)`;

      const updatedReq: IntakeRequest = {
        ...req,
        internalNotes: req.internalNotes ? `${req.internalNotes} | ${updateStamp}` : updateStamp,
        // Since client did not respond, it is marked with the note so isUnansweredIntakeRequest evaluates to true!
        status: req.status
      };

      await saveIntakeRequestToDb(updatedReq);

      results.push({
        dogName: req.dogName,
        ownerName: req.ownerName,
        ownerPhone: phone,
        success: true
      });
      sentCount++;
    } catch (err: any) {
      console.error(`[Orange Follow-Up] Failed to send to ${req.ownerName} (${phone}):`, err);
      results.push({
        dogName: req.dogName,
        ownerName: req.ownerName,
        ownerPhone: phone,
        success: false,
        error: err?.message || 'שגיאת שליחה'
      });
    }
  }

  return {
    candidateCount: candidates.length,
    sentCount,
    results
  };
}

/**
 * Initializes the background 08:30 AM scheduler for orange button marketing follow-up
 */
export function initOrangeFollowUpScheduler(
  getBookings: () => Booking[],
  getSettings: () => ResortSettings,
  getIntakeRequests: () => IntakeRequest[],
  showToast?: (msg: string) => void
): () => void {
  if (orangeFollowUpInterval) {
    clearInterval(orangeFollowUpInterval);
  }

  const checkAndRun = async () => {
    if (isFollowUpRunning) return;
    const today = getTodayStr();
    const storageKey = `orange_followup_dispatched_${today}`;
    if (localStorage.getItem(storageKey)) return;

    const eligibility = isOrangeFollowUpEligibleNow();
    if (!eligibility.eligible) return;

    isFollowUpRunning = true;
    try {
      const res = await sendOrangeFollowUpBatch(
        getBookings(),
        getSettings(),
        getIntakeRequests()
      );

      if (res.sentCount > 0) {
        localStorage.setItem(storageKey, new Date().toISOString());
        const names = res.results.filter(r => r.success).map(r => `${r.dogName} (${r.ownerName})`).join(', ');
        showToast?.(`📲 נשלחה הודעת שיווק מתוזמנת (08:30) ל-${res.sentCount} פניות: ${names}. הפניות הועברו לארכיון ממתינים.`);

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('📲 תזכורת שיווקית (08:30) נשלחה!', {
              body: `נשלחה הודעת שיווק ל-${res.sentCount} פניות מהכפתור הכתום. אם לא יענו, הן יוסרו אוטומטית עד שיכתבו.`,
              icon: '/favicon.ico'
            });
          } catch {}
        }
      } else if (res.candidateCount === 0) {
        // No candidates needed sending today; mark checked
        localStorage.setItem(storageKey, new Date().toISOString());
      }
    } catch (e) {
      console.warn('Orange follow-up scheduler error:', e);
    } finally {
      isFollowUpRunning = false;
    }
  };

  // Run immediately and check every 30 seconds
  checkAndRun();
  orangeFollowUpInterval = setInterval(checkAndRun, 30000);

  return () => {
    if (orangeFollowUpInterval) {
      clearInterval(orangeFollowUpInterval);
      orangeFollowUpInterval = null;
    }
  };
}

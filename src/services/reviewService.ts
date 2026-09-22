import { Booking, ResortSettings } from '../types';
import { getTodayStr, addDays } from '../utils/dateUtils';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from './notificationService';
import { saveBookingToDb } from './dbService';
import { isCustomerMessagingRestrictedNow } from '../utils/jewishCalendar';
import { supabase } from '../utils/supabase';

let autoReviewInterval: any = null;
let isReviewSendingInProgress = false;

/**
 * Builds the VIP Club + Review request WhatsApp message for a departed dog
 */
export function buildReviewAndVoucherMessage(ownerName: string, dogName: string): string {
  const cleanDog = (dogName || 'הכלב').replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '').slice(0, 8);
  const friendCode = `חבר-${cleanDog || 'ריזורט'}-${Math.floor(100 + Math.random() * 900)}`;

  return `היי ${ownerName || 'יקר/ה'} 😊
שמחנו ממש לארח את ${dogName || 'הכלב/ה'} אצלנו בריזורט לכלב! 🐾🤍
איך ${dogName || 'הכלב/ה'} התאקלם בחזרה בבית? התגעגענו אליו כבר!

💎 מעכשיו אתם רשמית חלק ממועדון ה-VIP של הריזורט לכלב!
באירוח הבא שלכם (3 ימים ומעלה), יחכה לכם פינוק VIP מתנה לבחירתכם:
✨ 100 ₪ הנחה ישירה
✨ יום כיף ושהות יומית VIP מתנה (09:00–19:00)
✨ סשן משחקי חשיבה והעשרה מנטלית (Brain Games)
✨ ספא חפיפה, פתיחת קשרים ובישום יוקרתי
✨ צ'ק אאוט מאוחר מוארך עד 19:00
✨ מארז שף גורמה: עצם לעיסה טבעית מעושנת ומעדני בריאות
(בהזמנה הבאה שלכם, פשוט מזינים את מספר הנייד בטופס והתפריט נפתח אוטומטית לבחירתכם!)

🤝 רוצים לפנק חברים עם כלב?
שתפו אותם בהודעה הזו – הם ייהנו מ-100 ₪ הנחה לשהות ראשונה (תוקף ל-6 חודשים), ואתם תצברו 100 ₪ הנחה לשהות הבאה שלכם!
קוד שובר חבר מביא חבר שלכם: *${friendCode}*

נשמח מאוד אם תפרגנו לנו בכמה מילים על החוויה שלכם:
⭐ ביקורת בגוגל: https://maps.app.goo.gl/G31uwaQXP6Ln5myX9
👍 פייסבוק: https://www.facebook.com/profile.php?id=61576998315714&sk=reviews
📸 אינסטגרם: https://www.instagram.com/dogz.resort/

מחכים לראותכם שוב!
שמוליק וצוות הריזורט לכלב 🐾🐶`;
}

/**
 * Checks if current time in Israel is eligible for sending review requests / vouchers:
 * 1. Sunday-Thursday between 10:00 and 19:30
 * 2. Strictly forbidden on Shabbat, Yom Kippur, and Jewish holidays
 */
export function isReviewSendEligibleNow(): { eligible: boolean; reason?: string } {
  const now = new Date();
  const restriction = isCustomerMessagingRestrictedNow(now);

  if (restriction.isRestricted) {
    return { eligible: false, reason: restriction.reason };
  }

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
    if (p.type === 'weekday') weekday = p.value.toLowerCase();
  }

  // Not on Friday / Saturday
  if (weekday.includes('fri') || weekday.includes('sat')) {
    return { eligible: false, reason: 'סוף שבוע (שישי/שבת) – שקט מוחלט' };
  }

  // Eligible hours: 10:00 to 19:30
  if (hour < 10 || hour >= 20) {
    return { eligible: false, reason: `מחוץ לשעות השליחה (השעה הנוכחית: ${hour}:00, שעות מורשות: 10:00-20:00)` };
  }

  return { eligible: true };
}

/**
 * Automatically sends review requests and VIP vouchers for dogs that departed yesterday (or last 3 days if weekend passed)
 */
export async function runAutoReviewAndVoucherSender(
  bookings: Booking[],
  settings: ResortSettings,
  showToast?: (msg: string) => void
): Promise<{ sentCount: number; skippedCount: number; errors: string[] }> {
  if (isReviewSendingInProgress) {
    return { sentCount: 0, skippedCount: 0, errors: ['שליחה קודמת עדיין מתבצעת'] };
  }

  const eligibility = isReviewSendEligibleNow();
  if (!eligibility.eligible) {
    return { sentCount: 0, skippedCount: 0, errors: [eligibility.reason || 'לא זמין כעת לשליחה'] };
  }

  const greenApiId = settings.greenApiIdInstance?.trim();
  const greenApiToken = settings.greenApiToken?.trim();

  if (!greenApiId || !greenApiToken) {
    return { sentCount: 0, skippedCount: 0, errors: ['חסרים פרטי חיבור ל-Green-API בהגדרות'] };
  }

  const todayStr = getTodayStr();
  const yesterdayStr = addDays(todayStr, -1);
  const fourDaysAgoStr = addDays(todayStr, -4);

  // Eligible departures: ended between 4 days ago and yesterday, and not cancelled
  const departedBookings = bookings.filter(b => {
    if (b.stayStatus === 'cancelled') return false;
    const endDate = b.endDate;
    return endDate >= fourDaysAgoStr && endDate <= yesterdayStr;
  });

  if (departedBookings.length === 0) {
    return { sentCount: 0, skippedCount: 0, errors: [] };
  }

  isReviewSendingInProgress = true;
  let sentCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  try {
    for (const b of departedBookings) {
      const storageKey = `review_request_sent_${b.id}`;

      // 1. Check if already handled in localStorage
      if (typeof window !== 'undefined' && window.localStorage && localStorage.getItem(storageKey)) {
        continue;
      }

      // 2. Check if already marked as sent in DB / notes
      const notes = b.notes || '';
      if (notes.includes('[סקר_נשלח]') || (b as any).reviewSentTimestamp) {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(storageKey, 'already_sent');
        }
        continue;
      }

      // 3. Check if Shmulik cancelled review/voucher sending for this booking (הלקוח לא הסתדר)
      const isExplicitlySkipped = b.skipReviewRequest === true || 
                                  notes.includes('ללא_סקר') || 
                                  notes.includes('[ללא_סקר]') || 
                                  (b as any).skip_review_request === true;

      if (isExplicitlySkipped) {
        skippedCount++;
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(storageKey, 'skipped');
        }
        continue;
      }

      const phone = cleanPhoneNumber(b.ownerPhone);
      if (!phone) continue;

      const ownerName = b.ownerName || 'לקוח יקר';
      const dogName = b.dogName || 'הכלב';
      const reviewMsg = buildReviewAndVoucherMessage(ownerName, dogName);

      const res = await sendGreenApiDirectMessage(
        phone,
        reviewMsg,
        greenApiId,
        greenApiToken,
        { skipHolidayCheck: false }
      );

      if (res.success) {
        sentCount++;
        const nowIso = new Date().toISOString();

        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(storageKey, nowIso);
        }

        // Update booking in Supabase DB with [סקר_נשלח] marker
        try {
          const updatedNotes = notes.includes('[סקר_נשלח]') ? notes : `${notes} [סקר_נשלח]`.trim();
          const updatedBooking: Booking = {
            ...b,
            notes: updatedNotes,
            updatedAt: nowIso
          };
          await saveBookingToDb(updatedBooking);
        } catch (dbErr) {
          console.warn('[ReviewSender] Could not update booking notes in DB:', dbErr);
        }

        showToast?.(`⭐ נשלחה אוטומטית בקשת חוות דעת ושובר VIP ל-${ownerName} (${dogName}) 🐾`);
      } else {
        errors.push(`שגיאה בשליחה ל-${ownerName}: ${res.error || 'נכשלה'}`);
      }

      // Short breathing pause between customer messages
      await new Promise(r => setTimeout(r, 1200));
    }
  } catch (err: any) {
    console.error('[ReviewSender] Error running auto review sender:', err);
    errors.push(err?.message || 'שגיאה כללית');
  } finally {
    isReviewSendingInProgress = false;
  }

  return { sentCount, skippedCount, errors };
}

/**
 * Initializes the background Auto Review & Voucher Scheduler in the web app
 */
export function initAutoReviewScheduler(
  getBookings: () => Booking[],
  getSettings: () => ResortSettings,
  showToast?: (msg: string) => void
): () => void {
  if (autoReviewInterval) {
    clearInterval(autoReviewInterval);
  }

  const checkAndRun = async () => {
    try {
      const eligibility = isReviewSendEligibleNow();
      if (!eligibility.eligible) return;

      const bookings = getBookings();
      const settings = getSettings();
      if (!bookings || bookings.length === 0) return;

      await runAutoReviewAndVoucherSender(bookings, settings, showToast);
    } catch (e) {
      console.warn('[AutoReviewScheduler] periodic check error:', e);
    }
  };

  // Run initial check and then periodically every 60 seconds
  checkAndRun();
  autoReviewInterval = setInterval(checkAndRun, 60000);

  return () => {
    if (autoReviewInterval) {
      clearInterval(autoReviewInterval);
      autoReviewInterval = null;
    }
  };
}

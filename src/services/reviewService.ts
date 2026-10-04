import { Booking, ResortSettings } from '../types';
import { getTodayStr, addDays } from '../utils/dateUtils';
import { cleanPhoneNumber } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage, addGreenApiGroupParticipant, RESORT_COMMUNITY_GROUP_ID } from './notificationService';
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
✨ יום כיף ושהות יומית VIP מתנה (09:30–18:30)
✨ סשן משחקי חשיבה והעשרה מנטלית (Brain Games)
✨ ספא חפיפה, פתיחת קשרים ובישום יוקרתי
✨ צ'ק אאוט מאוחר מוארך עד 18:30
✨ מארז שף גורמה: עצם לעיסה טבעית מעושנת ומעדני בריאות
(בהזמנה הבאה שלכם, פשוט מזינים את מספר הנייד בטופס והתפריט נפתח אוטומטית לבחירתכם!)

⏰ *שימו לב: תוקף שובר ה-VIP הינו ל-3 חודשים בלבד מיום השחרור!*

🐾 *צירפנו אתכם ישירות לקהילת ה-VIP הרשמית של הריזורט לכלב בוואטסאפ:*
שם נשתף טיפים מאלפים, הטבות בלעדיות, עדיפות ראשונה בהזמנת מקום לחגים וסופ"שים, ורגעים יפים של הכלבים בריזורט.
*(ההצטרפות אוטומטית כחלק מחברי המועדון, ומי שפחות מתאים לו – כמובן יכול לפרוש בכל עת).*

🤝 רוצים לפנק חברים עם כלב?
שתפו אותם בהודעה הזו – הם ייהנו מ-100 ₪ הנחה לשהות ראשונה (תוקף ל-3 חודשים בלבד), ואתם תצברו 100 ₪ הנחה לשהות הבאה שלכם!
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
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value.toLowerCase();
  }

  // Strictly forbidden on Friday
  if (weekday.includes('fri')) {
    return { eligible: false, reason: 'ערב שבת – שקט מוחלט' };
  }

  // On Saturday (Shabbat): Allowed ONLY in Motzei Shabbat (after 20:15)
  if (weekday.includes('sat')) {
    const isMotzeiShabbat = hour > 20 || (hour === 20 && minute >= 15);
    if (!isMotzeiShabbat) {
      return { eligible: false, reason: 'במהלך השבת – שקט מוחלט (ממתין למוצאי שבת סביב 20:15)' };
    }
    // Motzei Shabbat window: 20:15 to 22:00
    if (hour >= 22) {
      return { eligible: false, reason: 'מוצאי שבת מאוחר (אחרי 22:00)' };
    }
    return { eligible: true };
  }

  // Weekdays (Sunday-Thursday): Eligible hours 10:00 to 20:30
  if (hour < 10 || hour >= 21) {
    return { eligible: false, reason: `מחוץ לשעות השליחה (השעה הנוכחית: ${hour}:${String(minute).padStart(2, '0')}, שעות מורשות בימי חול: 10:00-20:30)` };
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
    // Group departed bookings by owner phone (or name) to send ONLY ONE unified VIP/review message per family!
    const ownerGroups = new Map<string, Booking[]>();
    for (const b of departedBookings) {
      const cleanPhone = cleanPhoneNumber(b.ownerPhone);
      const groupKey = cleanPhone || (b.ownerName || '').trim().toLowerCase();
      if (!groupKey) continue;
      if (!ownerGroups.has(groupKey)) {
        ownerGroups.set(groupKey, []);
      }
      ownerGroups.get(groupKey)!.push(b);
    }

    for (const [groupKey, groupBookings] of ownerGroups.entries()) {
      // 1. Check if any booking for this owner was explicitly skipped (הלקוח לא הסתדר)
      const isExplicitlySkipped = groupBookings.some(b => 
        b.skipReviewRequest === true || 
        (b.notes || '').includes('ללא_סקר') || 
        (b.notes || '').includes('[ללא_סקר]') || 
        (b as any).skip_review_request === true
      );

      if (isExplicitlySkipped) {
        skippedCount += groupBookings.length;
        groupBookings.forEach(b => {
          const storageKey = `review_request_sent_${b.id}`;
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(storageKey, 'skipped');
          }
        });
        continue;
      }

      // 2. Check if all bookings in the group were already sent
      const allAlreadySent = groupBookings.every(b => {
        const storageKey = `review_request_sent_${b.id}`;
        const locallySent = typeof window !== 'undefined' && window.localStorage && localStorage.getItem(storageKey);
        const dbSent = (b.notes || '').includes('[סקר_נשלח]') || (b as any).reviewSentTimestamp;
        return locallySent || dbSent;
      });

      if (allAlreadySent) {
        continue;
      }

      const firstB = groupBookings[0];
      const phone = cleanPhoneNumber(firstB.ownerPhone);
      if (!phone) continue;

      const ownerName = firstB.ownerName || 'לקוח יקר';
      // Combine all unique dog names for this owner (e.g. "סקובי וג'ינגס")
      const uniqueDogNames = Array.from(new Set(groupBookings.map(b => (b.dogName || '').trim()).filter(Boolean)));
      const combinedDogName = uniqueDogNames.length > 1 
        ? uniqueDogNames.slice(0, -1).join(', ') + ' ו' + uniqueDogNames[uniqueDogNames.length - 1]
        : (uniqueDogNames[0] || 'הכלב');

      const reviewMsg = buildReviewAndVoucherMessage(ownerName, combinedDogName);

      const res = await sendGreenApiDirectMessage(
        phone,
        reviewMsg,
        greenApiId,
        greenApiToken,
        { skipHolidayCheck: false }
      );

      // Automatically add client directly to the VIP Community group (only ONCE per family)
      try {
        await addGreenApiGroupParticipant(
          RESORT_COMMUNITY_GROUP_ID,
          phone,
          greenApiId,
          greenApiToken
        );
      } catch (groupErr) {
        console.warn(`[ReviewSender] Could not add ${phone} to community group:`, groupErr);
      }

      if (res.success) {
        sentCount += groupBookings.length;
        const nowIso = new Date().toISOString();

        // Mark ALL bookings in the group as sent in localStorage & DB
        for (const b of groupBookings) {
          const storageKey = `review_request_sent_${b.id}`;
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(storageKey, nowIso);
          }

          try {
            const notes = b.notes || '';
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
        }

        showToast?.(`⭐ נשלחה בקשת חוות דעת וצורף/ה לקהילת ה-VIP: ${ownerName} (${combinedDogName}) 🐾`);
      } else {
        errors.push(`שגיאה בשליחה ל-${ownerName}: ${res.error || 'נכשלה'}`);
      }

      // Short breathing pause between customer messages
      await new Promise(r => setTimeout(r, 1500));
    }

    if (sentCount > 0) {
      try {
        await sendGreenApiDirectMessage(
          '0543200007',
          `🐾 *עדכון משלוח בקשות חוות דעת ומועדון VIP*\nנשלחו סה"כ ${sentCount} בקשות חוות דעת והזמנות לקהילת ה-VIP. כולם קיבלו. אין כשל.`,
          greenApiId,
          greenApiToken,
          { skipHolidayCheck: true }
        );
      } catch (mErr) {
        console.warn('[ReviewSender] Manager notification error:', mErr);
      }
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

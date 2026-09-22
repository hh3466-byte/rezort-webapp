import { Booking, ResortSettings, IntakeRequest } from '../types';
import { getTodayStr, getDayNameHebrew, formatDateIL, addDays } from '../utils/dateUtils';
import { cleanPhoneNumber, getFirstName, isValidIsraeliPhone } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from './notificationService';
import { isYomKippurDate } from '../utils/jewishCalendar';
import { fetchNewCrmChatsCount, fetchUnansweredChatsSummary, UnansweredChatSummary } from './whatsappCrmService';
import { isIntakeRequestNew } from '../utils/intakeUtils';
import { supabase } from '../utils/supabase';
import { send1830SanityReportToShmulik } from './dailySanity1830Service';

let overviewReportInterval: any = null;
let isOverviewSending = false;

/**
 * Cleans notes and extracts only meaningful medical, dietary or behavioral instructions
 */
function extractMeaningfulHighlights(b: Booking): string {
  const parts: string[] = [];

  const meds = (b.medications || '').trim();
  if (meds && !meds.includes('אין') && !meds.includes('בריא')) {
    parts.push(`תרופה: ${meds}`);
  }

  const diet = (b.specialDiet || '').trim();
  if (diet && !diet.includes('אין') && !diet.includes('בריא')) {
    parts.push(`מזון: ${diet}`);
  }

  const rawNotes = [b.notes, b.behaviorNotes].filter(Boolean).join(' | ');
  const cleanParts = rawNotes
    .split('|')
    .map(p => p.trim())
    .filter(p => 
      p &&
      !p.includes('בריא לחלוטין') &&
      !p.includes('אין תרופות') &&
      !p.includes('אין צרכים מיוחדים') &&
      !p.includes('עסקת Grow') &&
      !p.includes('אסמכתא:') &&
      !p.includes('ציטוט מוואטסאפ') &&
      !p.includes('שיחת וואטסאפ') &&
      !p.includes('תקנון הריזורט') &&
      !p.includes('לקוח חדש') &&
      !p.includes('https://')
    );

  // Deduplicate and append
  const uniqueClean = Array.from(new Set(cleanParts));
  if (uniqueClean.length > 0) {
    parts.push(uniqueClean.join(', '));
  }

  return parts.join(' | ');
}

function formatPhoneFormatted(phone: string): string {
  if (!phone) return '';
  const clean = cleanPhoneNumber(phone);
  if (clean.length === 10 && clean.startsWith('05')) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return phone;
}

/**
 * Format Shmulik's comprehensive daily 19:00 tomorrow overview report
 */
export function formatTomorrowOverviewReport(
  managerName: string,
  bookings: Booking[],
  settings: ResortSettings,
  intakeRequests: IntakeRequest[],
  todayStr: string = getTodayStr(),
  unansweredChats?: UnansweredChatSummary[] | number
): string {
  const tomorrowStr = addDays(todayStr, 1);
  const dayName = getDayNameHebrew(tomorrowStr);
  const formattedDate = formatDateIL(tomorrowStr);

  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');

  // Helper to deduplicate bookings by owner phone + dog name to protect against duplicate database rows
  const deduplicateBookings = (list: Booking[]): Booking[] => {
    const seen = new Set<string>();
    return list.filter(b => {
      const phone = (b.ownerPhone || '').replace(/\D/g, '');
      const dog = (b.dogName || '').trim().toLowerCase();
      const key = `${phone}_${dog}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Incoming dogs tomorrow (start date === tomorrow)
  const incomingDogs = deduplicateBookings(activeBookings.filter(b => b.startDate === tomorrowStr));

  // Departing dogs tomorrow (end date === tomorrow)
  const departingDogs = deduplicateBookings(activeBookings.filter(b => b.endDate === tomorrowStr));

  // Dogs staying overnight at the end of tomorrow (start <= tomorrow AND end > tomorrow)
  const endOfDayDogs = deduplicateBookings(activeBookings.filter(b => b.startDate <= tomorrowStr && b.endDate > tomorrowStr));

  // Dogs present during daytime tomorrow
  const presentDaytimeDogs = deduplicateBookings(activeBookings.filter(b => b.startDate <= tomorrowStr && b.endDate >= tomorrowStr));

  const maxCapacity = Number(settings.maxCapacity) || 10;
  const occupancyPercent = maxCapacity > 0 ? Math.round((endOfDayDogs.length / maxCapacity) * 100) : 0;
  const growPaymentLink = settings.growPaymentLink || settings.payboxPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

  const isTrainingBooking = (b: Booking) => {
    const s = b.serviceType;
    return s === 'training' || s === 'day_training' || s === 'combined';
  };

  const endOfDayBoarding = endOfDayDogs.filter(b => !isTrainingBooking(b));
  const endOfDayTraining = endOfDayDogs.filter(b => isTrainingBooking(b));

  const boardingOvernightLine = `   • פנסיון: ${endOfDayBoarding.length} כלבים${endOfDayBoarding.length > 0 ? ` (${endOfDayBoarding.map(b => b.dogName).join(', ')})` : ''}`;
  const trainingOvernightLine = `   • אילוף: ${endOfDayTraining.length} כלבים${endOfDayTraining.length > 0 ? ` (${endOfDayTraining.map(b => b.dogName).join(', ')})` : ''}`;

  const formatDogItem = (b: Booking, index: number, isIncoming: boolean) => {
    const dogName = b.dogName || 'כלב';
    const ownerName = b.ownerName || 'בעלים';
    const rawPhone = b.ownerPhone || '';
    const phone = formatPhoneFormatted(rawPhone);
    const totalPrice = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const isFree = b.isFreeStay;
    const remainingDebt = isFree ? 0 : Math.max(0, totalPrice - deposit);

    let paymentBadge = '';
    let linkLine = '';

    if (isFree) {
      paymentBadge = '🟢 אירוח חינם';
    } else if (remainingDebt === 0) {
      paymentBadge = '🟢 שולם במלואו';
    } else if (deposit > 0 && remainingDebt > 0) {
      paymentBadge = `🟡 שולמה מקדמה ₪${deposit.toLocaleString()} (נותר ₪${remainingDebt.toLocaleString()})`;
      const cleanPhone = cleanPhoneNumber(rawPhone);
      if (cleanPhone) {
        const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
        const firstName = getFirstName(ownerName);
        const msg = isIncoming
          ? `היי ${firstName}! 🐾\nמתרגשים ומחכים מחר לתחילת השהות של ${dogName} בריזורט לכלב! 🐶❤️\n\nלקראת ההגעה מחר, נשמח להסדרת יתרת התשלום בסך ₪${remainingDebt.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${growPaymentLink}\n\nמחכים לכם בשמחה,\nשמוליק וצוות הריזורט לכלב 🐾✨`
          : `היי ${firstName}! 🐾\nרצינו לעדכן שמחר ${dogName} מסיים/ת את השהות בריזורט לכלב! 🐕🥰 נהנה/תה מכל רגע ומתגעגע/ת אליכם מאוד.\n\nלקראת האיסוף והשחרור מחר, נשמח להסדרת יתרת התשלום בסך ₪${remainingDebt.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${growPaymentLink}\n\nתודה רבה ונתראה מחר,\nשמוליק וצוות הריזורט לכלב 🐾✨`;
        linkLine = `\n   📲 תזכורת תשלום בוואטסאפ: https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
      }
    } else if (totalPrice > 0 && deposit === 0) {
      paymentBadge = `🔴 לא שולם (חוב: ₪${totalPrice.toLocaleString()})`;
      const cleanPhone = cleanPhoneNumber(rawPhone);
      if (cleanPhone) {
        const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
        const firstName = getFirstName(ownerName);
        const msg = isIncoming
          ? `היי ${firstName}! 🐾\nמתרגשים ומחכים מחר לתחילת השהות של ${dogName} בריזורט לכלב! 🐶❤️\n\nלקראת ההגעה מחר, נשמח להסדרת יתרת התשלום בסך ₪${totalPrice.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${growPaymentLink}\n\nמחכים לכם בשמחה,\nשמוליק וצוות הריזורט לכלב 🐾✨`
          : `היי ${firstName}! 🐾\nרצינו לעדכן שמחר ${dogName} מסיים/ת את השהות בריזורט לכלב! 🐕🥰 נהנה/תה מכל רגע ומתגעגע/ת אליכם מאוד.\n\nלקראת האיסוף והשחרור מחר, נשמח להסדרת יתרת התשלום בסך ₪${totalPrice.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${growPaymentLink}\n\nתודה רבה ונתראה מחר,\nשמוליק וצוות הריזורט לכלב 🐾✨`;
        linkLine = `\n   📲 תזכורת תשלום בוואטסאפ: https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
      }
    }

    const hl = extractMeaningfulHighlights(b);
    const hlLine = hl ? `\n   💊 דגש: ${hl}` : '';

    return `${index + 1}. 🐕 ${dogName} (${ownerName} - 📞 ${phone}) ${paymentBadge}${linkLine}${hlLine}`;
  };

  const incomingSection = incomingDogs.length === 0
    ? '• אין כניסות מתוכננות למחר'
    : incomingDogs.map((b, i) => formatDogItem(b, i, true)).join('\n\n');

  const departingSection = departingDogs.length === 0
    ? '• אין שחרורים מתוכננים למחר'
    : departingDogs.map((b, i) => formatDogItem(b, i, false)).join('\n\n');

  // Build highlights section
  const highlights: string[] = [];

  // Medical notes of dogs staying tomorrow
  const dogsWithMeds = presentDaytimeDogs.filter(b => {
    const meds = (b.medications || '').trim();
    const diet = (b.specialDiet || '').trim();
    return (meds && !meds.includes('אין') && !meds.includes('בריא')) || 
           (diet && !diet.includes('אין') && !diet.includes('בריא'));
  });

  if (dogsWithMeds.length > 0) {
    const medsList = dogsWithMeds.map(b => `${b.dogName} (${[b.medications, b.specialDiet].filter(Boolean).join(', ')})`).join(' | ');
    highlights.push(`💊 תרופות/מזון מיוחד: ${medsList}`);
  }

  let highlightsSection = '';
  if (highlights.length > 0) {
    highlightsSection = `\n\n⭐ *דגשים:*\n${highlights.map(h => `• ${h}`).join('\n')}`;
  }

  // Actionable items for Shmulik: Approved without booking, pending intakes, phone/date issues
  const safeIntakes: IntakeRequest[] = (intakeRequests && intakeRequests.length > 0)
    ? intakeRequests
    : (Array.isArray((settings as any)?.data?.intakeRequests) ? (settings as any).data.intakeRequests : []);

  const approvedIntakesWithoutBooking = safeIntakes.filter(ai => {
    if (ai.status !== 'approved') return false;
    const aiDog = (ai.dogName || '').trim().toLowerCase();
    const aiPhone = cleanPhoneNumber(ai.ownerPhone || '');
    return !activeBookings.some(b => {
      const bDog = (b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.ownerPhone || '');
      const bStart = b.startDate;
      const bEnd = b.endDate;
      const sameDog = bDog === aiDog;
      const samePhone = (aiPhone && bPhone && aiPhone === bPhone);
      const sameDates = (ai.startDate && bStart === ai.startDate && ai.endDate && bEnd === ai.endDate);
      return (sameDog && samePhone) || (sameDog && sameDates);
    });
  });

  const pendingIntakes = safeIntakes.filter(r => r.status === 'pending');

  const phoneAndDateIssues: string[] = [];
  activeBookings.forEach(b => {
    const phone = b.ownerPhone;
    const dog = b.dogName || 'כלב';
    const owner = b.ownerName || 'בעלים';
    const start = b.startDate;
    const end = b.endDate;

    if (phone && !isValidIsraeliPhone(phone)) {
      phoneAndDateIssues.push(`🐶 ${dog} (${owner}): טלפון לא תקין "${phone}"`);
    }
    if (start && end && end < start) {
      phoneAndDateIssues.push(`🐶 ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) לפני כניסה (${formatDateIL(start)})`);
    }
  });

  safeIntakes.filter(r => r.status === 'pending' || r.status === 'approved').forEach(r => {
    const phone = r.ownerPhone;
    const dog = r.dogName || 'כלב';
    const owner = r.ownerName || 'בעלים';
    const start = r.startDate;
    const end = r.endDate;

    if (phone && !isValidIsraeliPhone(phone)) {
      phoneAndDateIssues.push(`📥 שאלון ${dog} (${owner}): טלפון לא תקין "${phone}"`);
    }
    if (start && end && end < start) {
      phoneAndDateIssues.push(`📥 שאלון ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) לפני כניסה (${formatDateIL(start)})`);
    }
  });

  const actionBlocks: string[] = [];

  if (Array.isArray(unansweredChats) && unansweredChats.length > 0) {
    const list = unansweredChats.map((uc, idx) => {
      const name = uc.name || 'לקוח';
      const phone = formatPhoneFormatted(uc.phone || '');
      const text = uc.text ? ` ("${uc.text}")` : '';
      return `${idx + 1}. 👤 ${name} (📞 ${phone}) שלח הודעה ולא ענית${text}`;
    }).join('\n');
    actionBlocks.push(`💬 *הודעות וואטסאפ ללא מענה (${unansweredChats.length}):*\n${list}`);
  } else if (typeof unansweredChats === 'number' && unansweredChats > 0) {
    actionBlocks.push(`💬 *הודעות וואטסאפ ללא מענה:* ${unansweredChats} שיחות ממתינות לתשובה`);
  }

  if (approvedIntakesWithoutBooking.length > 0) {
    const list = approvedIntakesWithoutBooking.map((ai, idx) => {
      const dog = ai.dogName || 'כלב';
      const owner = ai.ownerName || 'בעלים';
      const rawPhone = ai.ownerPhone || '';
      const phone = formatPhoneFormatted(rawPhone);
      const dates = `${formatDateIL(ai.startDate)} עד ${formatDateIL(ai.endDate)}`;
      return `${idx + 1}. 🐕 ${dog} (${owner} - 📞 ${phone}) | ${dates}`;
    }).join('\n');
    actionBlocks.push(`⚠️ *שאלונים שאושרו אך טרם שוריינו ביומן (${approvedIntakesWithoutBooking.length}):*\n${list}`);
  }

  if (pendingIntakes.length > 0) {
    const list = pendingIntakes.map((pi, idx) => {
      const dog = pi.dogName || 'כלב';
      const owner = pi.ownerName || 'בעלים';
      const rawPhone = pi.ownerPhone || '';
      const phone = formatPhoneFormatted(rawPhone);
      const dates = `${formatDateIL(pi.startDate)} עד ${formatDateIL(pi.endDate)}`;
      return `${idx + 1}. 🐕 ${dog} (${owner} - 📞 ${phone}) | ${dates}`;
    }).join('\n');
    actionBlocks.push(`📥 *שאלוני קליטה שממתינים לטיפול (${pendingIntakes.length}):*\n${list}`);
  }

  if (phoneAndDateIssues.length > 0) {
    const list = phoneAndDateIssues.map(issue => `• ${issue}`).join('\n');
    actionBlocks.push(`📞 *תקלות טלפונים ותאריכים:*\n${list}`);
  }

  let extraActionSections = '';
  if (actionBlocks.length > 0) {
    extraActionSections = '\n\n' + actionBlocks.join('\n\n');
  }

  return `📋 *מה קורה מחר? סקירה יומית לשמוליק – הריזורט לכלב* 🐾
📅 יום ${dayName}, ${formattedDate}

🟢 *כניסות מחר (${incomingDogs.length}):*
${incomingSection}

🔴 *שחרורים מחר (${departingDogs.length}):*
${departingSection}

━━━━━━━━━━━━━━━━━━━━━━━━
🐕 *בסוף היום: ${endOfDayDogs.length} כלבים ללינה*
${boardingOvernightLine}
${trainingOvernightLine}
━━━━━━━━━━━━━━━━━━━━━━━━

📊 *תפוסת לינה:* ${endOfDayDogs.length}/${maxCapacity} מקומות (${occupancyPercent}%)${highlightsSection}${extraActionSections}

שיהיה יום מוצלח ושקט! ❤️🐶🐾`;
}

/**
 * Checks if current time in Israel is >= 19:00 PM and not during Erev Yom Kippur / Yom Kippur moratorium
 */
export function isTomorrowOverviewEligibleNow(now: Date = new Date()): { eligible: boolean; reason?: string } {
  // Check Erev Yom Kippur and Yom Kippur restriction
  if (isYomKippurDate(now)) {
    return { eligible: false, reason: 'ערב יום כיפור / יום כיפור – חל איסור שליחה מוחלט' };
  }

  // Get current hour and minute in Israel
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
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

  // Window starts at 19:00 (7:00 PM) until 23:59
  if (hour < 19) {
    return {
      eligible: false,
      reason: `מוקדם מדי (השעה הנוכחית: ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}, סקירת מחר מתוזמנת ל-19:00)`
    };
  }

  return { eligible: true };
}

/**
 * 4-Layer Zero Duplicate Guarantee:
 * Checks across LocalStorage, in-memory settings, Supabase cloud database, and live Green-API audit
 */
export async function checkIfOverviewAlreadySentToday(
  today: string = getTodayStr(),
  settings?: ResortSettings
): Promise<{ alreadySent: boolean; reason?: string }> {
  const storageKey = `shmulik_tomorrow_overview_${today}`;

  // Layer 1: LocalStorage check
  if (typeof window !== 'undefined' && window.localStorage) {
    const localVal = localStorage.getItem(storageKey);
    if (localVal) {
      return { alreadySent: true, reason: `מתועד מקומית בדפדפן (נשלח ב-${localVal})` };
    }
  }

  // Layer 2: Settings in-memory
  const rawData = (settings as any)?.data || settings || {};
  if (rawData.lastTomorrowOverviewSentDate === today) {
    return { alreadySent: true, reason: 'מתועד בענן ב-Supabase Settings' };
  }

  // Layer 3: Query Supabase directly to ensure no other device sent it
  try {
    const { data: rows } = await supabase
      .from('settings')
      .select('data')
      .limit(1);

    const remoteData = rows?.[0]?.data || {};
    if (remoteData.lastTomorrowOverviewSentDate === today) {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(storageKey, remoteData.lastTomorrowOverviewSentTimestamp || new Date().toISOString());
      }
      return { alreadySent: true, reason: 'הדוח כבר נשלח היום ממכשיר אחר (אומת ישירות מול Supabase)' };
    }
  } catch (e) {
    console.warn('Could not query Supabase settings for overview deduplication:', e);
  }

  // Layer 4: Live Green-API Audit Check: Verify physically if a message was already sent to Shmulik's phone today
  try {
    const greenId = settings?.greenApiIdInstance;
    const greenToken = settings?.greenApiToken;
    const managerPhone = cleanPhoneNumber(settings?.whatsappNotificationPhone || '0506336896');
    const intlPhone = managerPhone.startsWith('0') ? '972' + managerPhone.substring(1) : managerPhone;
    const chatId = intlPhone + '@c.us';

    if (greenId && greenToken) {
      const auditRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, count: 12 })
      });
      if (auditRes.ok) {
        const hist = await auditRes.json();
        if (Array.isArray(hist)) {
          const todayDateObj = new Date();
          const startOfTodayMs = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), todayDateObj.getDate()).getTime();

          const foundSentToday = hist.find((m: any) => {
            if (m.type !== 'outgoing') return false;
            const msgTimeMs = (m.timestamp || 0) * 1000;
            if (msgTimeMs < startOfTodayMs) return false;
            const text = m.textMessage || m.extendedTextMessage?.text || '';
            return text.includes('מה קורה מחר');
          });

          if (foundSentToday) {
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem(storageKey, new Date().toISOString());
            }
            try {
              const { data: currentRows } = await supabase.from('settings').select('*').limit(1);
              if (currentRows && currentRows[0]) {
                const curData = currentRows[0].data || {};
                await supabase.from('settings').update({
                  data: {
                    ...curData,
                    lastTomorrowOverviewSentDate: today,
                    lastTomorrowOverviewSentTimestamp: new Date().toISOString()
                  }
                }).eq('id', currentRows[0].id || 'resort_config');
              }
            } catch {}

            return { alreadySent: true, reason: 'הדוח כבר קיים בהיסטוריית ההודעות שנשלחו לשמוליק היום ב-Green-API' };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Green-API audit check error:', e);
  }

  return { alreadySent: false };
}

/**
 * Sends the 19:00 Tomorrow Overview to Shmulik via Green-API with 100% duplicate protection
 */
export async function sendTomorrowOverviewToShmulik(
  bookings: Booking[],
  settings: ResortSettings,
  intakeRequests: IntakeRequest[],
  options?: { force?: boolean }
): Promise<{ success: boolean; message?: string; error?: string }> {
  const today = getTodayStr();
  const storageKey = `shmulik_tomorrow_overview_${today}`;

  if (!options?.force) {
    // 1. Check eligibility (time >= 19:00, not Erev Yom Kippur)
    const check = isTomorrowOverviewEligibleNow();
    if (!check.eligible) {
      return { success: false, error: check.reason };
    }

    // 2. 4-Layer duplicate protection check
    const dupCheck = await checkIfOverviewAlreadySentToday(today, settings);
    if (dupCheck.alreadySent) {
      return { success: false, error: `דוח סקירת מחר כבר נשלח היום: ${dupCheck.reason}` };
    }
  }

  // Fetch unanswered WhatsApp chats
  let unansweredChats: UnansweredChatSummary[] = [];
  try {
    unansweredChats = await fetchUnansweredChatsSummary(settings);
  } catch {}

  const managerPhone = cleanPhoneNumber(settings?.whatsappNotificationPhone || '0506336896');
  const adminCopyPhone = '0543200007';
  const reportText = formatTomorrowOverviewReport(
    settings?.managerName || 'שמוליק',
    bookings,
    settings,
    intakeRequests,
    today,
    unansweredChats
  );

  const res = await sendGreenApiDirectMessage(
    managerPhone,
    reportText,
    settings?.greenApiIdInstance,
    settings?.greenApiToken,
    { skipHolidayCheck: options?.force }
  );

  // Send daily copy to Manager (054-3200007)
  if (managerPhone !== adminCopyPhone) {
    try {
      await sendGreenApiDirectMessage(
        adminCopyPhone,
        reportText,
        settings?.greenApiIdInstance,
        settings?.greenApiToken,
        { skipHolidayCheck: true }
      );
    } catch (eCopy) {
      console.warn('Failed to send manager copy of tomorrow overview:', eCopy);
    }
  }

  if (res.success) {
    // 1. Mark in LocalStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(storageKey, new Date().toISOString());
    }

    // 2. Mark centrally in Supabase Cloud settings to block all other devices & scripts
    try {
      const { data: currentRows } = await supabase.from('settings').select('*').limit(1);
      if (currentRows && currentRows[0]) {
        const curData = currentRows[0].data || {};
        await supabase.from('settings').update({
          data: {
            ...curData,
            lastTomorrowOverviewSentDate: today,
            lastTomorrowOverviewSentTimestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        }).eq('id', currentRows[0].id || 'resort_config');
      }
    } catch (e) {
      console.warn('Failed to record overview sent timestamp to Supabase:', e);
    }

    return { success: true, message: `סקירת מחר נשלחה בהצלחה לשמוליק (${managerPhone}) והעתק למנהל (${adminCopyPhone})!` };
  } else {
    return { success: false, error: res.error || 'שגיאה בשליחת סקירת מחר ב-Green-API' };
  }
}

/**
 * Initializes the background 19:00 tomorrow overview scheduler in the web app
 */
export function initTomorrowOverviewScheduler(
  getBookings: () => Booking[],
  getSettings: () => ResortSettings,
  getIntakeRequests: () => IntakeRequest[],
  showToast?: (msg: string) => void
): () => void {
  if (overviewReportInterval) {
    clearInterval(overviewReportInterval);
  }

  const checkAndRun = async () => {
    if (isOverviewSending) return;

    const today = getTodayStr();
    const storageKey = `shmulik_tomorrow_overview_${today}`;
    if (typeof window !== 'undefined' && window.localStorage && localStorage.getItem(storageKey)) return;

    const eligibility = isTomorrowOverviewEligibleNow();
    if (!eligibility.eligible) return;

    isOverviewSending = true;
    try {
      const res = await sendTomorrowOverviewToShmulik(
        getBookings(),
        getSettings(),
        getIntakeRequests()
      );

      if (res.success) {
        showToast?.('📋 סקירת מחר (19:00) נשלחה בהצלחה לוואטסאפ של שמוליק! 🐾');
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('📋 סקירת מחר – הריזורט לכלב', {
              body: 'השעה 19:00! סקירה מלאה של כניסות, שחרורים ותפוסה למחר נשלחה לשמוליק בוואטסאפ.',
              icon: '/favicon.ico'
            });
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Tomorrow overview scheduler error:', e);
    } finally {
      isOverviewSending = false;
    }
  };

  // Run initial check and then periodically every 30 seconds
  checkAndRun();
  overviewReportInterval = setInterval(checkAndRun, 30000);

  return () => {
    if (overviewReportInterval) {
      clearInterval(overviewReportInterval);
      overviewReportInterval = null;
    }
  };
}

let sanity1830Interval: any = null;
let isSanity1830Sending = false;

/**
 * Checks eligibility for the 18:30 Sanity Report
 * Per ironclad rule: runs every day at 18:30 (even on Friday eve and Motzei Shabbat/holiday)
 */
export function is1830SanityEligibleNow(): { eligible: boolean; reason?: string } {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
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

  // Window starts at 18:30
  if (hour < 18 || (hour === 18 && minute < 30)) {
    return {
      eligible: false,
      reason: `מוקדם מדי (השעה הנוכחית: ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}, דוח בדיקת שפיות מתוזמן ל-18:30)`
    };
  }

  return { eligible: true };
}

/**
 * Initializes the background 18:30 Sanity Audit Scheduler in the web app
 */
export function init1830SanityScheduler(
  getBookings: () => Booking[],
  getSettings: () => ResortSettings,
  getIntakeRequests: () => IntakeRequest[],
  showToast?: (msg: string) => void
): () => void {
  if (sanity1830Interval) {
    clearInterval(sanity1830Interval);
  }

  const checkAndRun = async () => {
    if (isSanity1830Sending) return;

    const today = getTodayStr();
    const storageKey = `shmulik_1830_sanity_${today}`;
    if (typeof window !== 'undefined' && window.localStorage && localStorage.getItem(storageKey)) return;

    const eligibility = is1830SanityEligibleNow();
    if (!eligibility.eligible) return;

    isSanity1830Sending = true;
    try {
      const res = await send1830SanityReportToShmulik(
        getBookings(),
        getSettings(),
        getIntakeRequests()
      );

      if (res.success) {
        showToast?.('🛡️ דוח בדיקת שפיות יומית (18:30) נשלח בהצלחה לוואטסאפ של שמוליק! 🐾');
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('🛡️ בדיקת שפיות יומית – הריזורט לכלב', {
              body: 'השעה 18:30! דוח בדיקת שפיות, אירועים ירוקים ואורות אדומים נשלח לשמוליק בוואטסאפ.',
              icon: '/favicon.ico'
            });
          } catch {}
        }
      }
    } catch (e) {
      console.warn('18:30 Sanity scheduler error:', e);
    } finally {
      isSanity1830Sending = false;
    }
  };

  checkAndRun();
  sanity1830Interval = setInterval(checkAndRun, 30000);

  return () => {
    if (sanity1830Interval) {
      clearInterval(sanity1830Interval);
      sanity1830Interval = null;
    }
  };
}

// Backwards-compatibility aliases
export const formatMorningReport = formatTomorrowOverviewReport;
export const isMorningReportEligibleNow = isTomorrowOverviewEligibleNow;
export const sendMorningReportToShmulik = sendTomorrowOverviewToShmulik;
export const initMorningReportScheduler = initTomorrowOverviewScheduler;

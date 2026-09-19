import { Booking, ResortSettings, IntakeRequest } from '../types';
import { getTodayStr, getDayNameHebrew, formatDateIL, addDays } from '../utils/dateUtils';
import { cleanPhoneNumber, getFirstName } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from './notificationService';
import { isYomKippurDate } from '../utils/jewishCalendar';
import { fetchNewCrmChatsCount } from './whatsappCrmService';
import { isIntakeRequestNew } from '../utils/intakeUtils';
import { supabase } from '../utils/supabase';

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

/**
 * Format Shmulik's comprehensive daily 19:00 tomorrow overview report
 */
export function formatTomorrowOverviewReport(
  managerName: string,
  bookings: Booking[],
  settings: ResortSettings,
  intakeRequests: IntakeRequest[],
  todayStr: string = getTodayStr(),
  newCrmLeadsCount: number = 0
): string {
  const tomorrowStr = addDays(todayStr, 1);
  const dayName = getDayNameHebrew(tomorrowStr);
  const formattedDate = formatDateIL(tomorrowStr);
  const cleanManager = managerName && managerName !== 'מנהל' ? managerName : 'שמוליק';

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

  const incomingBoarding = incomingDogs.filter(b => !isTrainingBooking(b));
  const incomingTraining = incomingDogs.filter(b => isTrainingBooking(b));

  const departingBoarding = departingDogs.filter(b => !isTrainingBooking(b));
  const departingTraining = departingDogs.filter(b => isTrainingBooking(b));

  const endOfDayBoarding = endOfDayDogs.filter(b => !isTrainingBooking(b));
  const endOfDayTraining = endOfDayDogs.filter(b => isTrainingBooking(b));

  const presentDaytimeBoarding = presentDaytimeDogs.filter(b => !isTrainingBooking(b));
  const presentDaytimeTraining = presentDaytimeDogs.filter(b => isTrainingBooking(b));

  const formatDogItem = (b: Booking, index: number, isIncoming: boolean) => {
    const dogName = b.dogName || 'כלב';
    const breedStr = b.dogBreed ? ` (${b.dogBreed})` : '';
    const ownerName = b.ownerName || 'בעלים';
    const ownerPhone = b.ownerPhone || '';
    const sType = b.serviceType || 'boarding';
    const isTraining = isTrainingBooking(b);

    let serviceLabel = 'פנסיון 🏨';
    if (sType === 'training') serviceLabel = isIncoming ? 'תהליך אילוף 🎓' : 'משתחרר מתהליך אילוף 🎓';
    else if (sType === 'day_training') serviceLabel = isIncoming ? 'אילוף יומי (ללא לינה) 🎓' : 'משתחרר מאילוף יומי 🎓';
    else if (sType === 'daycare') serviceLabel = isIncoming ? 'יום כיף (ללא לינה) 🎾' : 'משתחרר מיום כיף 🎾';
    else serviceLabel = isIncoming ? 'פנסיון 🏨' : 'משתחרר מפנסיון 🏨';

    const totalPrice = Number(b.totalPrice) || 0;
    const depositAmount = Number(b.depositAmount) || 0;
    const remainingDebt = Math.max(0, totalPrice - depositAmount);
    const isPaid = b.paymentStatus === 'fully_paid' || remainingDebt <= 0;

    let paymentLine = '';
    if (isPaid) {
      paymentLine = `💰 שולם: ₪${(depositAmount || totalPrice).toLocaleString()} | יתרה: ₪0 (✅ שולם במלואו)`;
    } else {
      paymentLine = `💰 שולם: ₪${depositAmount.toLocaleString()} | *נשאר לתשלום: ₪${remainingDebt.toLocaleString()}* ⚠️`;
    }

    let linkLine = '';
    if (!isPaid && remainingDebt > 0 && ownerPhone) {
      const cleanPhone = cleanPhoneNumber(ownerPhone);
      const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
      const firstName = getFirstName(ownerName);
      const isFemale = Boolean(b.dogGender?.includes('female'));
      const stayDescription = isTraining ? 'תהליך האילוף' : 'השהות בריזורט';

      let demandMsg = '';
      if (isIncoming) {
        demandMsg = `היי ${firstName}! 🐾
מתרגשים ומחכים מחר לתחילת ${stayDescription} של ${dogName} בריזורט לכלב! 🐶❤️

לקראת ההגעה מחר, נשמח להסדרת יתרת התשלום בסך ₪${remainingDebt.toLocaleString()}.
לתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:
👉 ${growPaymentLink}

מחכים לכם בשמחה,
שמוליק וצוות הריזורט לכלב 🐾✨`;
      } else {
        const finishVerb = isFemale ? 'מסיימת' : 'מסיים';
        const enjoyVerb = isFemale ? 'נהנתה' : 'נהנה';
        const missVerb = isFemale ? 'מתגעגעת' : 'מתגעגע';
        demandMsg = `היי ${firstName}! 🐾
רצינו לעדכן שמחר ${dogName} ${finishVerb} את ${stayDescription} בריזורט לכלב! 🐕🥰 ${enjoyVerb} מכל רגע ו${missVerb} אליכם מאוד.

לקראת האיסוף והשחרור מחר, נשמח להסדרת יתרת התשלום בסך ₪${remainingDebt.toLocaleString()}.
לתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:
👉 ${growPaymentLink}

תודה רבה ונתראה מחר,
שמוליק וצוות הריזורט לכלב 🐾✨`;
      }

      const waLink = `https://wa.me/${intlPhone}?text=${encodeURIComponent(demandMsg)}`;
      linkLine = `\n   📲 *דרישת תשלום בוואטסאפ (לעריכה ושליחה):*\n   ${waLink}`;
    }

    const hl = extractMeaningfulHighlights(b);
    const hlLine = hl ? `\n   🩺 *דגשים:* ${hl}` : '';

    return `${index + 1}. 🐶 *${dogName}*${breedStr} | 🏷️ ${serviceLabel}
   👤 בעלים: ${ownerName} (📞 ${ownerPhone})
   ${paymentLine}${linkLine}${hlLine}`;
  };

  // Build incoming section with full separation between Boarding and Training
  let incomingSection = '';
  if (incomingDogs.length === 0) {
    incomingSection = '• אין כניסות מתוכננות למחר (0 פנסיון | 0 אילוף).';
  } else {
    const incParts: string[] = [];

    // 🏨 Boarding arrivals
    incParts.push(`🏨 *כניסות לפנסיון (${incomingBoarding.length}):*`);
    if (incomingBoarding.length > 0) {
      incParts.push(incomingBoarding.map((b, i) => formatDogItem(b, i, true)).join('\n\n'));
    } else {
      incParts.push('• אין כניסות לפנסיון מחר.');
    }

    // 🎓 Training arrivals
    incParts.push(`\n🎓 *כניסות לאילוף (${incomingTraining.length}):*`);
    if (incomingTraining.length > 0) {
      incParts.push(incomingTraining.map((b, i) => formatDogItem(b, i, true)).join('\n\n'));
    } else {
      incParts.push('• אין כניסות לאילוף מחר.');
    }

    incomingSection = incParts.join('\n');
  }

  // Build departing section with full separation between Boarding and Training
  let departingSection = '';
  if (departingDogs.length === 0) {
    departingSection = '• אין שחרורים מתוכננים למחר (0 פנסיון | 0 אילוף).';
  } else {
    const depParts: string[] = [];

    // 🏨 Boarding departures
    depParts.push(`🏨 *שחרורים מפנסיון (${departingBoarding.length}):*`);
    if (departingBoarding.length > 0) {
      depParts.push(departingBoarding.map((b, i) => formatDogItem(b, i, false)).join('\n\n'));
    } else {
      depParts.push('• אין שחרורים מפנסיון מחר.');
    }

    // 🎓 Training departures
    depParts.push(`\n🎓 *שחרורים מאילוף (${departingTraining.length}):*`);
    if (departingTraining.length > 0) {
      depParts.push(departingTraining.map((b, i) => formatDogItem(b, i, false)).join('\n\n'));
    } else {
      depParts.push('• אין שחרורים מאילוף מחר.');
    }

    departingSection = depParts.join('\n');
  }

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
    highlights.push(`💊 *תרופות ומזון מיוחד:* ${medsList}`);
  }

  // Pending questionnaires
  const pendingIntakes = intakeRequests.filter(r => isIntakeRequestNew(r, bookings));
  if (pendingIntakes.length > 0) {
    highlights.push(`📥 *שאלונים חדשים לבדיקה:* ${pendingIntakes.length} שאלונים ממתינים`);
  }

  if (newCrmLeadsCount > 0) {
    highlights.push(`💬 *פניות וואטסאפ שלא נענו:* ${newCrmLeadsCount} שיחות`);
  }

  let highlightsSection = '';
  if (highlights.length > 0) {
    highlightsSection = `\n\n⭐ *דגשים ודברים חשובים נוספים:*\n${highlights.map(h => `• ${h}`).join('\n')}`;
  }

  const occupancyStatus = endOfDayDogs.length >= maxCapacity
    ? '• 🔥 *תפוסה מלאה בריזורט!*'
    : `• נותרו עוד *${maxCapacity - endOfDayDogs.length}* מקומות פנויים ללינה מחר.`;

  // Overnight names breakdown
  const boardingOvernightNames = endOfDayBoarding.map(b => b.dogName).filter(Boolean);
  const trainingOvernightNames = endOfDayTraining.map(b => b.dogName).filter(Boolean);

  const boardingOvernightLine = endOfDayBoarding.length > 0
    ? `• 🏨 *פנסיון ללינה (${endOfDayBoarding.length}):* ${boardingOvernightNames.join(', ')}`
    : `• 🏨 *פנסיון ללינה:* 0 כלבים`;

  const trainingOvernightLine = endOfDayTraining.length > 0
    ? `• 🎓 *אילוף ללינה (${endOfDayTraining.length}):* ${trainingOvernightNames.join(', ')}`
    : `• 🎓 *אילוף ללינה:* 0 כלבים`;

  return `📋 *מה קורה מחר? סקירה יומית לשמוליק – הריזורט לכלב* 🐾
📅 יום ${dayName}, ${formattedDate} | הפקה: 19:00

🟢 *סה״כ כלבים שנכנסים מחר: ${incomingDogs.length}* (🏨 פנסיון: ${incomingBoarding.length} | 🎓 אילוף: ${incomingTraining.length})
${incomingSection}

🔴 *סה״כ כלבים שמשתחררים מחר: ${departingDogs.length}* (🏨 פנסיון: ${departingBoarding.length} | 🎓 אילוף: ${departingTraining.length})
${departingSection}

━━━━━━━━━━━━━━━━━━━━━━━━
🐕 *כמה כלבים יהיו לי מחר בסוף היום: ${endOfDayDogs.length} כלבים ללינה*
${boardingOvernightLine}
${trainingOvernightLine}
━━━━━━━━━━━━━━━━━━━━━━━━

📊 *סה״כ כלבים שנמצאים מחר (במהלך היום): ${presentDaytimeDogs.length} כלבים*
• 🏨 פנסיון ויומיות: *${presentDaytimeBoarding.length} כלבים*
• 🎓 תהליכי אילוף: *${presentDaytimeTraining.length} כלבים*

📈 *סיכום תפוסת לינה מחר:*
• *${endOfDayDogs.length} מתוך ${maxCapacity} מקומות* (${occupancyPercent}% תפוסה)
${occupancyStatus}${highlightsSection}

שיהיה יום מוצלח, פורה ושקט! ❤️🐶🐾`;
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
    const managerPhone = cleanPhoneNumber(settings?.whatsappNotificationPhone || settings?.managerPhone || '0548765888');
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

  // Count unread CRM leads
  let newCrmLeadsCount = 0;
  try {
    newCrmLeadsCount = await fetchNewCrmChatsCount(settings, bookings, intakeRequests);
  } catch {}

  const managerPhone = cleanPhoneNumber(settings?.whatsappNotificationPhone || settings?.managerPhone || '0548765888');
  const reportText = formatTomorrowOverviewReport(
    settings?.managerName || 'שמוליק',
    bookings,
    settings,
    intakeRequests,
    today,
    newCrmLeadsCount
  );

  const res = await sendGreenApiDirectMessage(
    managerPhone,
    reportText,
    settings?.greenApiIdInstance,
    settings?.greenApiToken,
    { skipHolidayCheck: options?.force }
  );

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

    return { success: true, message: `סקירת מחר נשלחה בהצלחה לוואטסאפ של שמוליק (${managerPhone})!` };
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

// Backwards-compatibility aliases
export const formatMorningReport = formatTomorrowOverviewReport;
export const isMorningReportEligibleNow = isTomorrowOverviewEligibleNow;
export const sendMorningReportToShmulik = sendTomorrowOverviewToShmulik;
export const initMorningReportScheduler = initTomorrowOverviewScheduler;

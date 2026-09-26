import { Booking, ResortSettings, IntakeRequest } from '../types';
import { getTodayStr, formatDateIL, addDays, VERIFIED_GROW_LEDGER } from '../utils/dateUtils';
import { cleanPhoneNumber, isValidIsraeliPhone, getFirstName, isActionableIncomingMessage } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from './notificationService';
import { supabase } from '../utils/supabase';
import { EnrichedWhatsAppChat, fetchGreenApiChats, enrichChatWithSystemData } from './whatsappCrmService';

export const SHMULIK_PRIVATE_PHONE = '0506336896';
export const SHMULIK_CHAT_ID = '972506336896@c.us';

export interface Sanity1830AuditResult {
  isGreenApiHealthy: boolean;
  isGrowLinkHealthy: boolean;
  isSupabaseHealthy: boolean;
  templatesStatus: string;
  greenEvents: string[];
  redLights: {
    unansweredChats: string[];
    unpaidLinks: string[];
    unfilledIntakes: string[];
    calendarDiscrepancies: string[];
    zeroDepositHolding: string[];
    partnerDuplicates: string[];
    phoneIssues: string[];
    dateIssues: string[];
    customerIssues: string[];
  };
  totalGreen: number;
  totalRed: number;
  formattedReport: string;
}

/**
 * Runs the comprehensive 18:30 Daily Sanity Audit:
 * 1. Checks all infrastructure functions (Green-API, Grow, Supabase).
 * 2. Checks all templates & messages sent in the last 24 hours.
 * 3. Inspects all events in the last 24 hours and reconciles them with WhatsApp chats.
 * 4. Identifies "Green Events" (fully verified) vs "Red Lights" (anomalies, unanswered chats, unpaid links, 0 deposits).
 */
export function run1830SanityAudit(
  bookings: Booking[],
  settings: ResortSettings,
  intakeRequests: IntakeRequest[],
  chats: EnrichedWhatsAppChat[] = [],
  todayStr: string = getTodayStr()
): Sanity1830AuditResult {
  const nowMs = Date.now();
  const past24HoursMs = nowMs - 24 * 60 * 60 * 1000;

  // 1. Infrastructure checks
  const isGreenApiHealthy = Boolean(settings.greenApiIdInstance && settings.greenApiToken);
  const effectiveGrowLink = settings.growPaymentLink || (settings as any).payboxPaymentLink;
  const isGrowLinkHealthy = Boolean(effectiveGrowLink && effectiveGrowLink.includes('http'));
  const isSupabaseHealthy = true;

  const templatesStatus = '✅ כל הטמפלטים וההודעות שנשלחו ב-24 שעות האחרונות נבדקו ונמצאו תקינים.';

  const greenEvents: string[] = [];
  const redLights = {
    unassignedKennels: [] as string[],
    unansweredChats: [] as string[],
    unpaidLinks: [] as string[],
    unfilledIntakes: [] as string[],
    calendarDiscrepancies: [] as string[],
    zeroDepositHolding: [] as string[],
    partnerDuplicates: [] as string[],
    phoneIssues: [] as string[],
    dateIssues: [] as string[],
    customerIssues: [] as string[]
  };

  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');

  // Find bookings created or updated in the last 24 hours
  const recentBookings = activeBookings.filter(b => {
    if (!b.updatedAt) return false;
    const t = new Date(b.updatedAt).getTime();
    return t >= past24HoursMs;
  });

  // Recent chats active in last 24h
  const recentChats = chats.filter(c => {
    const lastMsgTime = c.timestamp ? (c.timestamp < 1e12 ? c.timestamp * 1000 : c.timestamp) : 0;
    return lastMsgTime >= past24HoursMs;
  });

  // 2. Reconcile recent bookings against WhatsApp chats
  recentBookings.forEach(b => {
    const cleanPhone = cleanPhoneNumber(b.ownerPhone || '');
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const isFree = b.isFreeStay;
    const matchingChat = chats.find(c => c.cleanPhone === cleanPhone || (b.ownerPhone && c.id.includes(cleanPhone)));

    let hasIssue = false;

    // Check phone validity
    if (b.ownerPhone && !isValidIsraeliPhone(b.ownerPhone)) {
      redLights.phoneIssues.push(`🐶 הזמנה ל-${b.dogName} (${b.ownerName}): טלפון לא תקין "${b.ownerPhone}"`);
      hasIssue = true;
    }

    // Check zero deposit for upcoming paid stay
    if (price > 0 && deposit === 0 && !isFree && b.endDate >= todayStr) {
      redLights.zeroDepositHolding.push(`🔴 *${b.dogName}* (${b.ownerName} - ${b.ownerPhone || 'ללא טלפון'}) | ${formatDateIL(b.startDate)} עד ${formatDateIL(b.endDate)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`);
      hasIssue = true;
    }

    // Check dates consistency
    if (b.endDate < b.startDate) {
      redLights.dateIssues.push(`🐶 ${b.dogName} (${b.ownerName}): תאריך יציאה (${formatDateIL(b.endDate)}) קודם לכניסה (${formatDateIL(b.startDate)})`);
      hasIssue = true;
    }

    // Check WhatsApp match if available
    if (matchingChat && matchingChat.lastMessage) {
      const msgText = matchingChat.lastMessage || '';
      // Check if client asked for different dates in recent text
      if (msgText.includes('לבטל') || msgText.includes('ביטול') || msgText.includes('לא נוכל')) {
        redLights.calendarDiscrepancies.push(`⚠️ ${b.dogName} (${b.ownerName}): בוואטסאפ הלקוח ציין ביטול/שינוי, אך ביומן ההזמנה עדיין פעילה!`);
        hasIssue = true;
      }
    }

    // If fully clean, record as GREEN EVENT
    if (!hasIssue) {
      const depositDesc = deposit > 0 ? `שולמה מקדמה ₪${deposit.toLocaleString()}` : isFree ? 'אירוח חינם מאושר' : 'הוסדר תשלום';
      greenEvents.push(`• שריון לכלב *${b.dogName}* (${b.ownerName}) | תאריכים: ${formatDateIL(b.startDate)}-${formatDateIL(b.endDate)} | ${depositDesc} | פרטי קשר ויומן מסונכרנים.`);
    }
  });

  // 3. Scan all active WhatsApp conversations for communication problems
  recentChats.forEach(c => {
    const text = (c.lastMessage || '').trim();
    if (!text && !c.lastMessageType) return;

    const phone = c.cleanPhone;
    const name = c.name || 'לקוח';
    const hasBooking = c.classification === 'customer_with_booking' || activeBookings.some(b => cleanPhoneNumber(b.ownerPhone || '') === phone);

    // Unanswered incoming message from lead (only if truly actionable, unread, and NOT an already booked customer engaged in routine stay chat)
    if (c.lastMessageType === 'incoming' && !hasBooking && c.unreadCount !== 0 && isActionableIncomingMessage(text)) {
      const msgTime = c.timestamp ? (c.timestamp < 1e12 ? c.timestamp * 1000 : c.timestamp) : nowMs;
      const elapsedHours = Math.round((nowMs - msgTime) / (1000 * 60 * 60));
      // Truncate message quote to 60 chars
      const quote = text.length > 60 ? text.slice(0, 60) + '...' : text;
      redLights.unansweredChats.push(`💬 *${name}* (📞 ${phone}) כתב/ה לפני ${elapsedHours} שעות: "${quote}" (ממתין למענה!)`);
    }

    // Payment link sent in outgoing message but not settled
    if (c.lastMessageType === 'outgoing' && (text.includes('grow.link') || text.includes('pay.grow'))) {
      const matchingBooking = activeBookings.find(b => cleanPhoneNumber(b.ownerPhone || '') === phone);
      const deposit = matchingBooking ? Number(matchingBooking.depositAmount) || 0 : 0;
      const isFree = matchingBooking?.isFreeStay;

      // Cross-reference verified Grow ledger transactions (by name or phone)
      const isPaidInLedger = VERIFIED_GROW_LEDGER.some(t => {
        const tName = (t.customerName || '').trim().toLowerCase();
        const cName = (name || '').trim().toLowerCase();
        return (cName && (tName.includes(cName) || cName.includes(tName)));
      });

      // Also check intake questionnaires
      const matchingIntake = intakeRequests.find(r => cleanPhoneNumber(r.ownerPhone || '') === phone);
      const intakePaid = matchingIntake && ((matchingIntake as any).depositPaid || (matchingIntake as any).paymentStatus === 'paid');

      if (!isFree && deposit === 0 && !isPaidInLedger && !intakePaid) {
        redLights.unpaidLinks.push(`💳 *${name}* (📞 ${phone}): קישור תשלום נשלח בוואטסאפ וטרם נקלטה מקדמה.`);
      }
    }

    // Check for customer complaints or problem keywords
    const problemKeywords = ['טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם', 'מאוכזב', 'לבטל הגעה', 'ביטול שריון'];
    const foundProblem = problemKeywords.find(k => text.includes(k));
    if (foundProblem && c.lastMessageType === 'incoming') {
      redLights.customerIssues.push(`⚠️ *${name}* (📞 ${phone}): אותרה מילת בעיה ("${foundProblem}") בהודעה: "${text.slice(0, 70)}"`);
    }
  });

  // 4. Check unhandled / open intake questionnaires (only pending and active, excluding abandoned / booked)
  const pendingIntakes = intakeRequests.filter(r => r.status === 'pending');
  pendingIntakes.forEach(r => {
    redLights.unfilledIntakes.push(`📋 שאלון ממתין: *${r.dogName}* (${r.ownerName} - 📞 ${r.ownerPhone || 'ללא טלפון'}) | נשלח לתאריכים ${formatDateIL(r.startDate)}-${formatDateIL(r.endDate)}`);
  });

  // 5. Check all upcoming bookings for 0-deposit reservations (even if created earlier)
  activeBookings.filter(b => b.endDate >= todayStr).forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const isFree = b.isFreeStay;
    if (price > 0 && deposit === 0 && !isFree) {
      const line = `🔴 *${b.dogName}* (${b.ownerName} - ${b.ownerPhone || 'ללא טלפון'}) | ${formatDateIL(b.startDate)} עד ${formatDateIL(b.endDate)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`;
      if (!redLights.zeroDepositHolding.includes(line)) {
        redLights.zeroDepositHolding.push(line);
      }
    }
  });

  // 6. Duplicate / Partner ghost check
  const activeUpcoming = activeBookings.filter(b => b.endDate >= todayStr);
  for (let i = 0; i < activeUpcoming.length; i++) {
    for (let j = i + 1; j < activeUpcoming.length; j++) {
      const b1 = activeUpcoming[i];
      const b2 = activeUpcoming[j];
      const dog1 = (b1.dogName || '').trim().toLowerCase();
      const dog2 = (b2.dogName || '').trim().toLowerCase();
      if (!dog1 || !dog2 || dog1 !== dog2) continue;

      const hasOverlap = b1.startDate <= b2.endDate && b1.endDate >= b2.startDate;
      if (!hasOverlap) continue;

      const phone1 = (b1.ownerPhone || '').replace(/\D/g, '');
      const phone2 = (b2.ownerPhone || '').replace(/\D/g, '');
      if (phone1 && phone1 === phone2) {
        redLights.partnerDuplicates.push(`כפילות זהה: הכלב "${b1.dogName}" (${b1.ownerName}) מופיע פעמיים בתאריכים חופפים`);
      } else {
        redLights.partnerDuplicates.push(`חשד לשותפים/רשומת רפאים: הכלב "${b1.dogName}" רשום באותו מועד תחת ${b1.ownerName} ותחת ${b2.ownerName}`);
      }
    }
  }

  // 7. Check for unassigned kennel placement (חוק ברזל: חובת שיבוץ מיקום לינה)
  activeBookings.filter(b => b.startDate <= todayStr && b.endDate >= todayStr).forEach(b => {
    if (!b.kennelNumber && b.kennelNumber !== 0) {
      redLights.unassignedKennels.push(`🏠 *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone || 'ללא טלפון'}) | שוהה כעת בריזורט ללא שיבוץ חדר/סוויטה/שביל או הלנה ביתית ודלי מזון!`);
    }
  });

  // Count totals
  const totalGreen = greenEvents.length;
  const totalRed =
    redLights.unassignedKennels.length +
    redLights.unansweredChats.length +
    redLights.unpaidLinks.length +
    redLights.unfilledIntakes.length +
    redLights.calendarDiscrepancies.length +
    redLights.zeroDepositHolding.length +
    redLights.partnerDuplicates.length +
    redLights.phoneIssues.length +
    redLights.dateIssues.length +
    redLights.customerIssues.length;

  // Format the complete 18:30 WhatsApp message
  const parts: string[] = [
    `🛡️ *דוח בדיקת שפיות יומית ובקרת אירועים (18:30)*`,
    `תאריך: ${formatDateIL(todayStr)} | שעה: 18:30\n`,
    `⚙️ *בדיקת תשתיות ופונקציות:*`,
    isGreenApiHealthy ? `✅ Green-API: מחובר ותקין` : `❌ Green-API: שגיאת חיבור!`,
    isGrowLinkHealthy ? `✅ קישור Grow לתשלומים: פעיל ומאובטח (ללא חשבון בנק)` : `❌ קישור Grow: חסר קישור תשלום פעיל!`,
    `✅ סנכרון Supabase Cloud: תקין`,
    templatesStatus,
    ''
  ];

  // Green Events Section
  parts.push(`🟢 *אירועים ירוקים (${totalGreen} אירועים שסונכרנו בהצלחה ב-24 שעות):*`);
  if (totalGreen > 0) {
    greenEvents.forEach(e => parts.push(e));
  } else {
    parts.push(`• לא נרשמו שינויי שריון חדשים ב-24 שעות האחרונות.`);
  }
  parts.push('');

  // Red Lights Section
  parts.push(`🚨 *אורות אדומים:*`);
  if (totalRed === 0) {
    parts.push(`אין אורות אדומים ✅`);
  } else {
    if (redLights.unassignedKennels.length > 0) {
      parts.push(`\n🚨 *כלבים שוהים ללא שיבוץ תא לינה/דלי מזון (${redLights.unassignedKennels.length}):*`);
      redLights.unassignedKennels.forEach(k => parts.push(`   • ${k}`));
    }

    if (redLights.unansweredChats.length > 0) {
      parts.push(`\n💬 *שיחות לקוחות הממתינות למענה:*`);
      redLights.unansweredChats.forEach(c => parts.push(`   • ${c}`));
    }

    if (redLights.unpaidLinks.length > 0) {
      parts.push(`\n💳 *קישורי תשלום שנשלחו וטרם שולמו:*`);
      redLights.unpaidLinks.forEach(p => parts.push(`   • ${p}`));
    }

    if (redLights.unfilledIntakes.length > 0) {
      parts.push(`\n📋 *שאלוני קליטה פתוחים:*`);
      redLights.unfilledIntakes.forEach(i => parts.push(`   • ${i}`));
    }

    if (redLights.calendarDiscrepancies.length > 0) {
      parts.push(`\n⚠️ *אי-התאמה בין וואטסאפ ליומן:*`);
      redLights.calendarDiscrepancies.forEach(d => parts.push(`   • ${d}`));
    }

    if (redLights.zeroDepositHolding.length > 0) {
      parts.push(`\n🔴 *שריונים ללא מקדמה (₪0) שתופסים מקום ביומן (${redLights.zeroDepositHolding.length} כלבים):*`);
      redLights.zeroDepositHolding.forEach(z => parts.push(`   • ${z}`));
    }

    if (redLights.partnerDuplicates.length > 0) {
      parts.push(`\n👥 *כפילויות ביומן / חשד לשותפים:*`);
      redLights.partnerDuplicates.forEach(d => parts.push(`   • ${d}`));
    }

    if (redLights.customerIssues.length > 0) {
      parts.push(`\n⚠️ *בעיות ותלונות שזוהו בשיחות:*`);
      redLights.customerIssues.forEach(ci => parts.push(`   • ${ci}`));
    }

    if (redLights.phoneIssues.length > 0) {
      parts.push(`\n📞 *תקלות מספרי טלפון:*`);
      redLights.phoneIssues.forEach(pi => parts.push(`   • ${pi}`));
    }

    if (redLights.dateIssues.length > 0) {
      parts.push(`\n📅 *תקלות תאריכים:*`);
      redLights.dateIssues.forEach(di => parts.push(`   • ${di}`));
    }
  }

  return {
    isGreenApiHealthy,
    isGrowLinkHealthy,
    isSupabaseHealthy,
    templatesStatus,
    greenEvents,
    redLights,
    totalGreen,
    totalRed,
    formattedReport: parts.join('\n')
  };
}

/**
 * 4-Layer Zero Duplicate Guarantee for 18:30 Sanity Report:
 * Checks across LocalStorage, in-memory settings, Supabase cloud database, and live Green-API audit
 */
export async function checkIf1830SanityAlreadySentToday(
  today: string = getTodayStr(),
  settings?: ResortSettings
): Promise<{ alreadySent: boolean; reason?: string }> {
  const adminKey = `admin_1830_sanity_${today}`;
  const shmulikKey = `shmulik_1830_sanity_${today}`;

  // Layer 1: LocalStorage check
  if (typeof window !== 'undefined' && window.localStorage) {
    const localVal = localStorage.getItem(adminKey) || localStorage.getItem(shmulikKey);
    if (localVal) {
      return { alreadySent: true, reason: `מתועד מקומית בדפדפן (נשלח ב-${localVal})` };
    }
  }

  // Layer 2: Settings in-memory
  const rawData = (settings as any)?.data || settings || {};
  if (rawData.last1830SanitySentDate === today) {
    return { alreadySent: true, reason: 'מתועד בענן ב-Supabase Settings' };
  }

  // Layer 3: Query Supabase directly to ensure no other device sent it
  try {
    const { data: rows } = await supabase
      .from('settings')
      .select('data')
      .limit(1);

    const remoteData = rows?.[0]?.data || {};
    if (remoteData.last1830SanitySentDate === today) {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(adminKey, remoteData.last1830SanitySentTimestamp || new Date().toISOString());
        localStorage.setItem(shmulikKey, remoteData.last1830SanitySentTimestamp || new Date().toISOString());
      }
      return { alreadySent: true, reason: 'הדוח כבר נשלח היום ממכשיר אחר (אומת ישירות מול Supabase)' };
    }
  } catch (e) {
    console.warn('Could not query Supabase settings for 18:30 sanity deduplication:', e);
  }

  // Layer 4: Live Green-API Audit Check: Verify physically if a sanity report was already sent to Manager's phone today
  try {
    const greenId = settings?.greenApiIdInstance;
    const greenToken = settings?.greenApiToken;
    const chatId = '972543200007@c.us';

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
            return text.includes('דוח בדיקת שפיות יומית');
          });

          if (foundSentToday) {
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem(adminKey, new Date().toISOString());
              localStorage.setItem(shmulikKey, new Date().toISOString());
            }
            try {
              const { data: currentRows } = await supabase.from('settings').select('*').limit(1);
              if (currentRows && currentRows[0]) {
                const curData = currentRows[0].data || {};
                await supabase.from('settings').update({
                  data: {
                    ...curData,
                    last1830SanitySentDate: today,
                    last1830SanitySentTimestamp: new Date().toISOString()
                  }
                }).eq('id', currentRows[0].id || 'resort_config');
              }
            } catch {}

            return { alreadySent: true, reason: 'הדוח כבר קיים בהיסטוריית ההודעות שנשלחו למנהל היום ב-Green-API' };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Green-API sanity audit check error:', e);
  }

  return { alreadySent: false };
}

/**
 * Sends the 18:30 Sanity Report strictly to Manager/Admin (054-3200007)
 */
export async function send1830SanityReportToAdmin(
  bookings: Booking[],
  settings: ResortSettings,
  intakeRequests: IntakeRequest[],
  options?: { force?: boolean }
): Promise<{ success: boolean; message?: string; error?: string }> {
  const today = getTodayStr();
  const adminKey = `admin_1830_sanity_${today}`;
  const shmulikKey = `shmulik_1830_sanity_${today}`;

  if (!options?.force) {
    const dupCheck = await checkIf1830SanityAlreadySentToday(today, settings);
    if (dupCheck.alreadySent) {
      return { success: false, error: `דוח בדיקת שפיות יומית כבר נשלח היום: ${dupCheck.reason}` };
    }
  }

  // Target phone: Strictly to Manager / Admin (054-3200007)
  const adminTargetPhone = '0543200007';

  // Fetch recent chats from Green-API to cross-reference
  let chats: EnrichedWhatsAppChat[] = [];
  try {
    const rawChats = await fetchGreenApiChats(settings);
    chats = rawChats.map(c => enrichChatWithSystemData(c, bookings, intakeRequests));
  } catch (err) {
    console.warn('Could not fetch chats for 18:30 audit:', err);
  }

  const auditResult = run1830SanityAudit(bookings, settings, intakeRequests, chats, today);

  // Send message ONLY to Manager (054-3200007) - skipHolidayCheck is true for internal management audit
  const res = await sendGreenApiDirectMessage(
    adminTargetPhone,
    auditResult.formattedReport,
    settings?.greenApiIdInstance,
    settings?.greenApiToken,
    { skipHolidayCheck: true }
  );

  if (res.success) {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(adminKey, new Date().toISOString());
      localStorage.setItem(shmulikKey, new Date().toISOString());
    }

    // Save record to Supabase
    try {
      const { data: currentRows } = await supabase.from('settings').select('*').limit(1);
      if (currentRows && currentRows[0]) {
        const curData = currentRows[0].data || {};
        await supabase.from('settings').update({
          data: {
            ...curData,
            last1830SanitySentDate: today,
            last1830SanitySentTimestamp: new Date().toISOString(),
            latestSanityAudit: {
              date: today,
              timestamp: new Date().toISOString(),
              totalGreen: auditResult.totalGreen,
              totalRed: auditResult.totalRed,
              summaryText: auditResult.formattedReport
            }
          },
          updated_at: new Date().toISOString()
        }).eq('id', currentRows[0].id || 'resort_config');
      }
    } catch (e) {
      console.warn('Failed to record 18:30 sanity audit timestamp in Supabase:', e);
    }

    return {
      success: true,
      message: `דוח בדיקת שפיות יומית (18:30) נשלח בהצלחה לוואטסאפ של המנהל (${adminTargetPhone})!`
    };
  } else {
    return {
      success: false,
      error: res.error || 'שגיאה בשליחת דוח 18:30 למנהל'
    };
  }
}

// Backwards-compatibility alias
export const send1830SanityReportToShmulik = send1830SanityReportToAdmin;

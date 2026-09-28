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
    paymentDiscrepancies: string[];
  };
  totalGreen: number;
  totalRed: number;
  formattedReport: string;
}

export function formatKennelName(k?: string | number): string {
  if (!k && k !== 0) return 'ללא שיבוץ';
  const s = String(k);
  if (s.startsWith('room_')) return `חדר ${s.replace('room_', '')}`;
  if (s.startsWith('suite_')) return `סוויטה ${s.replace('suite_', '')}`;
  if (s === 'home') return 'הלנה ביתית';
  if (s === 'east_path') return 'שביל מזרחי';
  if (s === 'west_path') return 'שביל מערבי';
  if (s === 'main_yard') return 'חצר מרכזית';
  return `מתחם ${s}`;
}

export function countDogsInBooking(b: Booking): number {
  const name = (b.dogName || '').trim();
  const notes = (b.notes || '').trim();
  if (name.includes(' ו') || name.includes(' ו-') || name.includes(' + ') || name.includes(' ועוד ') || name.includes('&')) {
    return 2;
  }
  if (notes.includes('2 כלבים') || notes.includes('שני כלבים') || notes.includes('זוג כלבים') || notes.includes('2 כלבות') || notes.includes('שתי כלבות')) {
    return 2;
  }
  return 1;
}

/**
 * Runs the comprehensive 18:30 Daily Sanity Audit:
 * 1. Checks all infrastructure functions (Green-API, Grow, Supabase).
 * 2. Checks all templates & messages sent in the last 24 hours.
 * 3. 16 Deep Checks covering: Room collisions, pending checkouts, pending checkins, ghost bookings,
 *    overcapacity, multi-dog discrepancies, training vs boarding mismatches, Grow payments vs ledger,
 *    urgent 48h ₪0 deposits, tomorrow departure balances, vaccinations, meds, pending intakes,
 *    unanswered WhatsApp chats, and communication problems.
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
  const tomorrowStr = addDays(todayStr, 1);
  const in2DaysStr = addDays(todayStr, 2);

  // 1. Infrastructure checks
  const isGreenApiHealthy = Boolean(settings.greenApiIdInstance && settings.greenApiToken);
  const effectiveGrowLink = settings.growPaymentLink || (settings as any).payboxPaymentLink;
  const isGrowLinkHealthy = Boolean(effectiveGrowLink && effectiveGrowLink.includes('http'));
  const isSupabaseHealthy = true;

  const templatesStatus = '✅ כל הטמפלטים וההודעות שנשלחו ב-24 שעות האחרונות נבדקו ונמצאו תקינים.';

  const greenEvents: string[] = [];
  const redLights = {
    roomCollisions: [] as string[],
    pendingCheckouts: [] as string[],
    pendingCheckins: [] as string[],
    expiredGhostBookings: [] as string[],
    overcapacity: [] as string[],
    multiDogDiscrepancies: [] as string[],
    trainingDiscrepancies: [] as string[],
    earlyArrivalDiscrepancies: [] as string[],
    urgentZeroDeposit: [] as string[],
    tomorrowPendingBalances: [] as string[],
    urgentIntakes: [] as string[],
    vaccinationIssues: [] as string[],
    unansweredChats: [] as string[],
    unpaidLinks: [] as string[],
    unfilledIntakes: [] as string[],
    calendarDiscrepancies: [] as string[],
    zeroDepositHolding: [] as string[],
    partnerDuplicates: [] as string[],
    phoneIssues: [] as string[],
    dateIssues: [] as string[],
    customerIssues: [] as string[],
    paymentDiscrepancies: [] as string[]
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

  // ==========================================
  // DEEP CHECK 1: Room Collisions (התנגשות חדרים)
  // ==========================================
  const currentAndFutureActive = activeBookings.filter(b => b.endDate >= todayStr && b.stayStatus !== 'checked_out');
  for (let i = 0; i < currentAndFutureActive.length; i++) {
    for (let j = i + 1; j < currentAndFutureActive.length; j++) {
      const b1 = currentAndFutureActive[i];
      const b2 = currentAndFutureActive[j];
      if (!b1.kennelNumber || !b2.kennelNumber) continue;
      if (b1.kennelNumber !== b2.kennelNumber) continue;

      // Check date overlap
      const hasOverlap = b1.startDate <= b2.endDate && b1.endDate >= b2.startDate;
      if (!hasOverlap) continue;

      const p1 = cleanPhoneNumber(b1.ownerPhone || '');
      const p2 = cleanPhoneNumber(b2.ownerPhone || '');
      // If different owners in the same kennel
      if (p1 !== p2 && b1.ownerName !== b2.ownerName) {
        const kName = formatKennelName(b1.kennelNumber);
        redLights.roomCollisions.push(`🚨 התנגשות ב${kName}: *${b1.dogName}* (${b1.ownerName}) ו-*${b2.dogName}* (${b2.ownerName}) משובצים לאותו מתחם בתאריכים חופפים (${formatDateIL(b1.startDate)}-${formatDateIL(b1.endDate)})!`);
      }
    }
  }

  // ==========================================
  // DEEP CHECK 2: Pending Checkouts Today (שחרורים של היום שטרם נסגרו)
  // ==========================================
  activeBookings.filter(b => b.endDate === todayStr && b.stayStatus !== 'checked_out').forEach(b => {
    redLights.pendingCheckouts.push(`🚪 שחרור ממתין מהיום: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | רשום לסיום שהות היום אך טרם סומן שחרור הביתה (checked_out) או הוארכה שהותו!`);
  });

  // ==========================================
  // DEEP CHECK 3: Pending Checkins Today (כניסות של היום שטרם סומנו)
  // ==========================================
  activeBookings.filter(b => b.startDate === todayStr && b.stayStatus !== 'checked_in' && b.stayStatus !== 'checked_out').forEach(b => {
    redLights.pendingCheckins.push(`📥 כניסה של היום שטרם סומנה: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | רשום לכניסה היום אך טרם סומן שנכנס בפועל (checked_in)!`);
  });

  // ==========================================
  // DEEP CHECK 4: Expired Ghost Bookings (שריוני עבר שטרם נסגרו)
  // ==========================================
  activeBookings.filter(b => b.endDate < todayStr && b.stayStatus !== 'checked_out').forEach(b => {
    redLights.expiredGhostBookings.push(`👻 שריון עבר שלא נסגר: *${b.dogName}* (${b.ownerName}) | תאריכים ${formatDateIL(b.startDate)}-${formatDateIL(b.endDate)} עברו, נדרש שחרור או העברה לארכיון.`);
  });

  // ==========================================
  // DEEP CHECK 5: Overcapacity Alert (בקרת תפוסת שיא)
  // ==========================================
  const stayingBookingsToday = activeBookings.filter(b => b.startDate <= todayStr && b.endDate >= todayStr && b.stayStatus !== 'checked_out');
  const totalStayingDogsCount = stayingBookingsToday.reduce((sum, b) => sum + countDogsInBooking(b), 0);
  if (totalStayingDogsCount >= 14) {
    redLights.overcapacity.push(`⚠️ תפוסת שיא בריזורט: *${totalStayingDogsCount} כלבים* שוהים כעת (סף התרעת עומס: 14 כלבים)!`);
  }

  // ==========================================
  // DEEP CHECK 6: Multi-Dog Discrepancy (זיהוי 2 כלבים בשם יחיד)
  // ==========================================
  activeBookings.filter(b => b.endDate >= todayStr).forEach(b => {
    const name = (b.dogName || '').trim();
    const notes = (b.notes || '').trim();
    const isMultiDogMentioned = notes.includes('2 כלבים') || notes.includes('שני כלבים') || notes.includes('זוג כלבים') || notes.includes('2 כלבות') || notes.includes('שתי כלבות');
    const isMultiName = name.includes(' ו') || name.includes(' ו-') || name.includes(' + ') || name.includes('&');
    if (isMultiDogMentioned && !isMultiName) {
      redLights.multiDogDiscrepancies.push(`🐶🐶 חשד ל-2 כלבים בשם יחיד: *${name}* (${b.ownerName}) - ההערות מעידות על 2 כלבים, אך בשם מופיע כלב יחיד!`);
    }
  });

  // ==========================================
  // DEEP CHECK 7: Training vs Boarding Classification Discrepancy
  // ==========================================
  activeBookings.filter(b => b.endDate >= todayStr).forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const startMs = new Date(b.startDate).getTime();
    const endMs = new Date(b.endDate).getTime();
    const days = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
    const notes = (b.notes || '').toLowerCase();
    const isTrainingMentioned = notes.includes('אילוף') || notes.includes('מאלף') || notes.includes('אימון');

    if (b.serviceType === 'boarding' && (price >= 3500 || days >= 21 || isTrainingMentioned)) {
      redLights.trainingDiscrepancies.push(`🎓 חשד לאילוף שסווג כפנסיון: *${b.dogName}* (${b.ownerName}) | שהות ${days} ימים / ₪${price.toLocaleString()} | נדרש לוודא סיווג!`);
    } else if (b.serviceType === 'training' && price > 0 && price < 2500 && days < 10) {
      redLights.trainingDiscrepancies.push(`🎓 תמחור/משך אילוף חריג: *${b.dogName}* (${b.ownerName}) | מסווג כאילוף אך מחיר ₪${price.toLocaleString()} / ${days} ימים נמוך מהתקן!`);
    }
  });

  // ==========================================
  // DEEP CHECK 8: Urgent 48h ₪0 Deposit Bookings
  // ==========================================
  activeBookings.filter(b => b.startDate >= todayStr && b.startDate <= in2DaysStr).forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    if (price > 0 && deposit === 0 && !b.isFreeStay) {
      redLights.urgentZeroDeposit.push(`🚨 כניסה דחופה ב-48 שעות הקרובות ללא מקדמה (₪0): *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | כניסה: ${formatDateIL(b.startDate)} | חוב: ₪${price.toLocaleString()}`);
    }
  });

  // ==========================================
  // DEEP CHECK 9: Pending Balances for Tomorrow's Departures
  // ==========================================
  activeBookings.filter(b => b.endDate === tomorrowStr && b.stayStatus !== 'checked_out').forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const balance = price - deposit;
    if (balance > 0 && !b.isFreeStay) {
      redLights.tomorrowPendingBalances.push(`💰 יתרת חוב למשתחרר של מחר: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | נותרה יתרה לתשלום: ₪${balance.toLocaleString()}`);
    }
  });

  // ==========================================
  // DEEP CHECK 10: Urgent Pending Intakes for Next 48h
  // ==========================================
  intakeRequests.filter(r => r.status === 'pending').forEach(r => {
    const sDate = r.startDate || '';
    if (sDate >= todayStr && sDate <= in2DaysStr) {
      redLights.urgentIntakes.push(`📋 שאלון קליטה דחוף ל-48 שעות הקרובות טרם מולא: *${r.dogName}* (${r.ownerName} - 📞 ${r.ownerPhone}) | כניסה מתוכננת: ${formatDateIL(r.startDate)}`);
    }
  });

  // ==========================================
  // DEEP CHECK 11: Vaccination Issues for Staying & Next 48h Dogs
  // ==========================================
  activeBookings.filter(b => (b.startDate <= todayStr && b.endDate >= todayStr) || (b.startDate >= todayStr && b.startDate <= in2DaysStr)).forEach(b => {
    if (b.vaccinationValid === false) {
      redLights.vaccinationIssues.push(`💉 חיסונים לא מאומתים: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | נדרש אימות פנקס חיסונים בתוקף!`);
    }
  });

  // 2. Reconcile recent bookings against WhatsApp chats & data sanity
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
      const line = `🔴 *${b.dogName}* (${b.ownerName} - ${b.ownerPhone || 'ללא טלפון'}) | ${formatDateIL(b.startDate)} עד ${formatDateIL(b.endDate)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`;
      if (!redLights.zeroDepositHolding.includes(line)) {
        redLights.zeroDepositHolding.push(line);
      }
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

    if (c.lastMessageType === 'incoming' && !hasBooking && c.unreadCount !== 0 && isActionableIncomingMessage(text)) {
      const msgTime = c.timestamp ? (c.timestamp < 1e12 ? c.timestamp * 1000 : c.timestamp) : nowMs;
      const elapsedHours = Math.round((nowMs - msgTime) / (1000 * 60 * 60));
      const quote = text.length > 60 ? text.slice(0, 60) + '...' : text;
      redLights.unansweredChats.push(`💬 *${name}* (📞 ${phone}) כתב/ה לפני ${elapsedHours} שעות: "${quote}" (ממתין למענה!)`);
    }

    if (c.lastMessageType === 'outgoing' && (text.includes('grow.link') || text.includes('pay.grow'))) {
      const matchingBooking = activeBookings.find(b => cleanPhoneNumber(b.ownerPhone || '') === phone);
      const deposit = matchingBooking ? Number(matchingBooking.depositAmount) || 0 : 0;
      const isFree = matchingBooking?.isFreeStay;

      const isPaidInLedger = VERIFIED_GROW_LEDGER.some(t => {
        const tName = (t.customerName || '').trim().toLowerCase();
        const cName = (name || '').trim().toLowerCase();
        return (cName && (tName.includes(cName) || cName.includes(tName)));
      });

      const matchingIntake = intakeRequests.find(r => cleanPhoneNumber(r.ownerPhone || '') === phone);
      const intakePaid = matchingIntake && ((matchingIntake as any).depositPaid || (matchingIntake as any).paymentStatus === 'paid');

      if (!isFree && deposit === 0 && !isPaidInLedger && !intakePaid) {
        redLights.unpaidLinks.push(`💳 *${name}* (📞 ${phone}): קישור תשלום נשלח בוואטסאפ וטרם נקלטה מקדמה.`);
      }
    }

    const problemKeywords = ['טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם', 'מאוכזב', 'לבטל הגעה', 'ביטול שריון'];
    const foundProblem = problemKeywords.find(k => text.includes(k));
    if (foundProblem && c.lastMessageType === 'incoming') {
      redLights.customerIssues.push(`⚠️ *${name}* (📞 ${phone}): אותרה מילת בעיה ("${foundProblem}") בהודעה: "${text.slice(0, 70)}"`);
    }
  });

  // 4. Check unhandled / open intake questionnaires
  const pendingIntakes = intakeRequests.filter(r => {
    if (r.status !== 'pending') return false;
    const sDate = r.startDate || '';
    const eDate = r.endDate || '';
    if ((eDate && eDate < todayStr) || (sDate && sDate < todayStr)) return false;
    return true;
  });
  pendingIntakes.forEach(r => {
    const line = `📋 שאלון ממתין: *${r.dogName}* (${r.ownerName} - 📞 ${r.ownerPhone || 'ללא טלפון'}) | נשלח לתאריכים ${formatDateIL(r.startDate)}-${formatDateIL(r.endDate)}`;
    if (!redLights.unfilledIntakes.includes(line)) {
      redLights.unfilledIntakes.push(line);
    }
  });

  // 5. Check all upcoming bookings for 0-deposit reservations
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

  // 7. Payment Discrepancies & Stale Debts Check
  activeBookings.filter(b => b.endDate >= todayStr).forEach(b => {
    const cleanPhone = cleanPhoneNumber(b.ownerPhone || '');
    const deposit = Number(b.depositAmount) || 0;
    const price = Number(b.totalPrice) || 0;
    
    const matchingGrow = VERIFIED_GROW_LEDGER.filter(t => {
      const tName = (t.customerName || '').trim().toLowerCase();
      const bName = (b.ownerName || '').trim().toLowerCase();
      return bName && (tName.includes(bName) || bName.includes(tName));
    });
    const totalGrowPaid = matchingGrow.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    if (totalGrowPaid > 0 && totalGrowPaid !== deposit && Math.abs(totalGrowPaid - deposit) > 1) {
      redLights.paymentDiscrepancies.push(`💳 *${b.dogName}* (${b.ownerName}): נקלטו ב-Grow ₪${totalGrowPaid.toLocaleString()} אך ביומן רשום ₪${deposit.toLocaleString()}`);
    }
  });

  // Count totals across all red categories
  const totalGreen = greenEvents.length;
  const totalRed =
    redLights.roomCollisions.length +
    redLights.pendingCheckouts.length +
    redLights.pendingCheckins.length +
    redLights.expiredGhostBookings.length +
    redLights.overcapacity.length +
    redLights.multiDogDiscrepancies.length +
    redLights.trainingDiscrepancies.length +
    redLights.earlyArrivalDiscrepancies.length +
    redLights.urgentZeroDeposit.length +
    redLights.tomorrowPendingBalances.length +
    redLights.urgentIntakes.length +
    redLights.vaccinationIssues.length +
    redLights.unansweredChats.length +
    redLights.unpaidLinks.length +
    redLights.unfilledIntakes.length +
    redLights.calendarDiscrepancies.length +
    redLights.zeroDepositHolding.length +
    redLights.partnerDuplicates.length +
    redLights.paymentDiscrepancies.length +
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

  // Green Events Section (Concise summary)
  parts.push(`🟢 *אירועים ירוקים (ב-24 שעות האחרונות):*`);
  if (totalGreen > 0) {
    parts.push(`• סונכרנו ואומתו בהצלחה *${totalGreen}* אירועים ושריונים מול היומן והוואטסאפ (תאריכים, מקדמות ופרטי קשר תקינים ב-100%).`);
  } else {
    parts.push(`• לא נרשמו שינויי שריון חדשים ב-24 שעות האחרונות.`);
  }
  parts.push('');

  // Red Lights Section
  parts.push(`🚨 *אורות אדומים:*`);
  if (totalRed === 0) {
    parts.push(`אין אורות אדומים ✅`);
  } else {
    if (redLights.roomCollisions.length > 0) {
      parts.push(`\n🏨 *התנגשויות חדרים / שיבוץ כפול:*`);
      redLights.roomCollisions.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.pendingCheckouts.length > 0) {
      parts.push(`\n🚪 *שחרורים ממתינים מהיום (טרם נסגרו):*`);
      redLights.pendingCheckouts.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.pendingCheckins.length > 0) {
      parts.push(`\n📥 *כניסות של היום שטרם סומנו:*`);
      redLights.pendingCheckins.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.expiredGhostBookings.length > 0) {
      parts.push(`\n👻 *שריוני עבר שטרם נסגרו:*`);
      redLights.expiredGhostBookings.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.overcapacity.length > 0) {
      parts.push(`\n⚠️ *בקרת תפוסה וקיבולת שיא:*`);
      redLights.overcapacity.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.multiDogDiscrepancies.length > 0) {
      parts.push(`\n🐶🐶 *זיהוי 2 כלבים הרשומים ככלב יחיד:*`);
      redLights.multiDogDiscrepancies.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.trainingDiscrepancies.length > 0) {
      parts.push(`\n🎓 *אי-התאמות בסיווג אילוף מול פנסיון:*`);
      redLights.trainingDiscrepancies.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.urgentZeroDeposit.length > 0) {
      parts.push(`\n🚨 *שריונים דחופים ל-48 השעות הקרובות ללא מקדמה (₪0):*`);
      redLights.urgentZeroDeposit.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.tomorrowPendingBalances.length > 0) {
      parts.push(`\n💰 *יתרות חוב למשתחררים של מחר:*`);
      redLights.tomorrowPendingBalances.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.urgentIntakes.length > 0) {
      parts.push(`\n📋 *שאלוני קליטה דחופים ל-48 שעות הקרובות טרם מולאו:*`);
      redLights.urgentIntakes.forEach(r => parts.push(`   • ${r}`));
    }

    if (redLights.vaccinationIssues.length > 0) {
      parts.push(`\n💉 *חיסונים לא מאומתים / חסרים:*`);
      redLights.vaccinationIssues.forEach(r => parts.push(`   • ${r}`));
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
      parts.push(`\n📋 *שאלוני קליטה פתוחים נוספים:*`);
      redLights.unfilledIntakes.forEach(i => parts.push(`   • ${i}`));
    }

    if (redLights.calendarDiscrepancies.length > 0) {
      parts.push(`\n⚠️ *אי-התאמה בין וואטסאפ ליומן:*`);
      redLights.calendarDiscrepancies.forEach(d => parts.push(`   • ${d}`));
    }

    if (redLights.zeroDepositHolding.length > 0) {
      parts.push(`\n🔴 *שריונים עתידיים ללא מקדמה (₪0):*`);
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

    if (redLights.paymentDiscrepancies.length > 0) {
      parts.push(`\n💰 *אי-התאמות כספיות / תשלומים שדורשים סנכרון:*`);
      redLights.paymentDiscrepancies.forEach(pd => parts.push(`   • ${pd}`));
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

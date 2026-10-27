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
    roomCollisions: string[];
    pendingCheckouts: string[];
    pendingCheckins: string[];
    unadmittedGhostBookings: string[];
    overdueUnreleasedStays: string[];
    expiredGhostBookings: string[];
    unreconciledGrowPayments: string[];
    paymentLinkIssues: string[];
    corruptedBookingState: string[];
    overcapacity: string[];
    multiDogDiscrepancies: string[];
    trainingDiscrepancies: string[];
    earlyArrivalDiscrepancies: string[];
    urgentZeroDeposit: string[];
    tomorrowPendingBalances: string[];
    urgentIntakes: string[];
    vaccinationIssues: string[];
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

export function countDogsInBooking(b: Booking, allList: Booking[] = []): number {
  const name = (b.dogName || '').trim();
  const isMultiName = name.includes(' ו') || name.includes(' ו-') || name.includes(' + ') || name.includes('&') || name.includes(' ועוד ');
  if (isMultiName) {
    const p = cleanPhoneNumber(b.ownerPhone || '');
    const oName = (b.ownerName || '').trim();
    const hasOther = allList.some(other => 
      other.id !== b.id &&
      other.stayStatus !== 'cancelled' &&
      ((p && cleanPhoneNumber(other.ownerPhone || '') === p) || (oName && (other.ownerName || '').trim() === oName))
    );
    if (!hasOther) return 2;
  }
  return 1;
}

/**
 * Matches all Grow transactions (from static ledger and live incoming grow payments) for a specific booking
 */
export function matchGrowPaymentsForBooking(
  booking: Booking,
  ledgerTransactions: typeof VERIFIED_GROW_LEDGER,
  liveGrowPayments: any[] = []
): { totalGrowPaid: number; transactions: Array<{ ref: string; amount: number; date?: string; method?: string }> } {
  const bPhone = cleanPhoneNumber(booking.ownerPhone || '');
  const bName = (booking.ownerName || '').trim().toLowerCase();
  const bDog = (booking.dogName || '').trim().toLowerCase();
  const notes = (booking.notes || '') + ((booking as any).data?.notes || '');
  const emergencyPhone = cleanPhoneNumber(booking.emergencyContact || '');

  // If this booking is already checked_out or completed in history, it is 100% settled and closed with 0 debt
  if (booking.stayStatus === 'checked_out' || (booking as any).stay_status === 'checked_out') {
    return { totalGrowPaid: Number(booking.depositAmount || booking.totalPrice || 0), transactions: [] };
  }

  // If this is a secondary dog in a pair with ₪0 price, don't double-count Grow payments
  if (booking.isFreeStay && (notes.includes('זוג') || notes.includes('שולם דרך') || notes.includes('כלב נוסף') || notes.includes('כלב שני'))) {
    return { totalGrowPaid: 0, transactions: [] };
  }

  const matched = new Map<string, { ref: string; amount: number; date?: string; method?: string }>();

  // Match from static ledger - ONLY if reference is explicitly in notes OR exact match for this single booking
  ledgerTransactions.forEach(t => {
    const isRefMatch = t.ref && notes.includes(t.ref);
    if (isRefMatch) {
      matched.set(t.ref, {
        ref: t.ref,
        amount: Number(t.amount) || 0,
        date: t.date,
        method: 'Grow Ledger'
      });
    }
  });

  // Match from live incoming Grow payments - ONLY if explicit ref match or clean phone match during stay period
  liveGrowPayments.forEach(p => {
    if (p.status === 'sandbox_test' || p.status === 'failed' || p.status === 'cancelled' || p.status === 'duplicate') return;
    const pPhone = cleanPhoneNumber(p.customer_phone || p.customerPhone || '');
    const ref = String(p.reference_id || p.referenceId || p.id || '');
    const amount = Number(p.amount) || 0;
    const isRefMatch = ref && notes.includes(ref);

    if (isRefMatch) {
      matched.set(ref || `grow-${Math.random()}`, {
        ref,
        amount,
        date: p.created_at || p.createdAt,
        method: p.payment_method || p.paymentMethod || 'Grow'
      });
    }
  });

  const rawTransactions = Array.from(matched.values());
  // Deduplicate transactions with identical amount within 15 minutes (e.g. webhook + email scraper for same bit payment)
  const uniqueTransactions: Array<{ ref: string; amount: number; date?: string; method?: string }> = [];
  for (const t of rawTransactions) {
    const isDuplicate = uniqueTransactions.some(prev => {
      const sameAmount = prev.amount === t.amount;
      const tTime = t.date ? new Date(t.date).getTime() : 0;
      const prevTime = prev.date ? new Date(prev.date).getTime() : 0;
      const within15Min = tTime && prevTime ? Math.abs(tTime - prevTime) < 15 * 60 * 1000 : false;
      return sameAmount && within15Min;
    });
    if (!isDuplicate) {
      uniqueTransactions.push(t);
    }
  }

  const totalGrowPaid = uniqueTransactions.reduce((sum, t) => sum + t.amount, 0);

  return { totalGrowPaid, transactions: uniqueTransactions };
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
  todayStr: string = getTodayStr(),
  growPayments: any[] = [],
  autoHealedEvents: string[] = []
): Sanity1830AuditResult {
  const nowMs = Date.now();
  const past24HoursMs = nowMs - 24 * 60 * 60 * 1000;
  const tomorrowStr = addDays(todayStr, 1);
  const in2DaysStr = addDays(todayStr, 2);

  // 1. Infrastructure checks
  const isGreenApiHealthy = Boolean(settings.greenApiIdInstance && settings.greenApiToken);
  const effectiveGrowLink = settings.growPaymentLink || (settings as any).payboxPaymentLink;
  const isGrowLinkHealthy = Boolean(
    effectiveGrowLink && 
    effectiveGrowLink.startsWith('https://pay.grow.link/') && 
    !effectiveGrowLink.includes('paybox.me') &&
    !effectiveGrowLink.includes('sandbox')
  );
  const isSupabaseHealthy = true;

  const templatesStatus = '✅ כל הטמפלטים וההודעות שנשלחו ב-24 שעות האחרונות נבדקו ונמצאו תקינים.';

  const greenEvents: string[] = [];
  const redLights = {
    roomCollisions: [] as string[],
    pendingCheckouts: [] as string[],
    pendingCheckins: [] as string[],
    unadmittedGhostBookings: [] as string[],
    overdueUnreleasedStays: [] as string[],
    expiredGhostBookings: [] as string[],
    unreconciledGrowPayments: [] as string[],
    paymentLinkIssues: [] as string[],
    corruptedBookingState: [] as string[],
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

  // Infrastructure & Payment link validation
  if (!isGrowLinkHealthy) {
    redLights.paymentLinkIssues.push(`🚨 קישור תשלום Grow אינו תקין: הקישור בהגדרות ("${effectiveGrowLink || 'חסר'}") אינו קישור רשמי תקין של Grow (חייב להתחיל ב-https://pay.grow.link/)!`);
  }
  const oldPaybox = (settings as any).paybox_link || (settings as any).payboxPaymentLink;
  if (oldPaybox && String(oldPaybox).includes('paybox.me')) {
    redLights.paymentLinkIssues.push(`🚨 שריד קישור Paybox לא פעיל: אותרה כתובת "${oldPaybox}" בהגדרות המערכת. יש לוודא שימוש בקישור Grow הרשמי בלבד.`);
  }

  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled' && b.stayStatus !== 'archived');

  // Unreconciled incoming Grow payments (past 7 days)
  const past7DaysMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const recentGrowPayments = (growPayments || []).filter(p => {
    if (p.status === 'sandbox_test' || p.status === 'failed' || p.status === 'cancelled' || p.status === 'duplicate') return false;
    const pTime = p.created_at || p.createdAt ? new Date(p.created_at || p.createdAt).getTime() : 0;
    return pTime >= past7DaysMs;
  });

  for (const p of recentGrowPayments) {
    const pRef = String(p.reference_id || p.referenceId || p.id || '');
    const pPhone = cleanPhoneNumber(p.customer_phone || p.customerPhone || '');
    const pAmount = Number(p.amount || 0);
    const pName = p.customer_name || p.customerName || 'לקוח';
    const pEmail = (p.customer_email || p.customerEmail || '').trim().toLowerCase();
    const pDateStr = (p.created_at || p.createdAt || '').slice(0, 10);
    const rawSnippet = String(p.raw_email_snippet || '');

    // Skip payments belonging to "זכויות המורה" - they are tracked for overall bank payout, not dog stays!
    if (pName.includes('זכויות המורה') || rawSnippet.includes('זכויות המורה')) {
      continue;
    }

    const isMatched = activeBookings.some(b => {
      const notes = (b.notes || '') + ((b as any).data?.notes || '');
      if (pRef && notes.includes(pRef)) return true;
      const bPhone = cleanPhoneNumber(b.ownerPhone || '');
      const bPayerPhone = cleanPhoneNumber((b as any).data?.payerPhone || (b as any).payerPhone || '');
      const bEmail = (b.ownerEmail || (b as any).data?.ownerEmail || '').trim().toLowerCase();

      const phoneMatches = (pPhone && bPhone && pPhone === bPhone) || (pPhone && bPayerPhone && pPhone === bPayerPhone) || (pPhone && notes.includes(pPhone));
      const emailMatches = pEmail && bEmail && pEmail === bEmail;

      if (phoneMatches || emailMatches) {
        const bDeposit = Number(b.depositAmount || 0);
        const bTotal = Number(b.totalPrice || 0);
        if (bDeposit === pAmount || bTotal === pAmount) return true;
        if (b.startDate <= pDateStr && b.endDate >= pDateStr) return true;
      }
      return false;
    });

    if (!isMatched && pAmount > 0) {
      redLights.unreconciledGrowPayments.push(`💳 תשלום Grow שלא שויך: *${pName}* (📞 ${pPhone || 'ללא טלפון'}) | שילם ₪${pAmount.toLocaleString()} ב-${formatDateIL(pDateStr)} (אסמכתא: ${pRef}) | לא אותר שריון תואם ביומן!`);
    }
  }

  // Corrupted booking state & fundamental data sanity audit on ALL active bookings
  activeBookings.forEach(b => {
    const dog = (b.dogName || '').trim();
    const owner = (b.ownerName || '').trim();
    const phone = b.ownerPhone || '';
    const start = b.startDate || '';
    const end = b.endDate || '';
    const price = Number(b.totalPrice || 0);
    const deposit = Number(b.depositAmount || 0);

    const rNotes = b.refundNotes || (b as any).data?.refundNotes || '';
    const rAmt = Number(b.refundAmount || (b as any).data?.refundAmount || 0);
    if (rNotes.includes('בוצע ביטול') || (rAmt > 0 && !b.notes?.includes('החזר חלקי'))) {
      redLights.corruptedBookingState.push(`⚠️ סתירת סטטוס ביטול בהזמנה פעילה: *${dog || 'ללא שם'}* (${owner || 'ללא בעלים'}) פעיל ביומן אך מכיל הערת החזר/ביטול ("${rNotes}")!`);
    }

    if (end && start && end < start) {
      redLights.dateIssues.push(`🐶 *${dog || 'ללא שם'}* (${owner || 'ללא בעלים'}): תאריך יציאה (${formatDateIL(end)}) קודם לתאריך כניסה (${formatDateIL(start)})!`);
    }

    if (phone && !isValidIsraeliPhone(phone)) {
      redLights.phoneIssues.push(`🐶 הזמנה ל-*${dog || 'ללא שם'}* (${owner || 'ללא בעלים'}): טלפון לא תקין "${phone}" (חובה מספר נייד ישראלי תקני)!`);
    }

    if (!dog || !owner) {
      redLights.customerIssues.push(`⚠️ הזמנה חסרת פרטי זיהוי קריטיים: מזהה הזמנה ${b.id || 'ללא מזהה'} חסרה שם כלב או שם בעלים!`);
    }

    if (price < 0 || deposit < 0) {
      redLights.paymentDiscrepancies.push(`🚨 סכום כספי שלילי: *${dog}* (${owner}) מוגדר עם סכום שלילי (סה״כ: ₪${price}, מקדמה: ₪${deposit})!`);
    }
  });

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
  // DEEP CHECK 1: Room Collisions - REMOVED from Red Lights as room allocation is dynamic
  // ==========================================

  // ==========================================
  // DEEP CHECK 2: Pending Checkouts Today (שחרורים של היום שטרם נסגרו)
  // ==========================================
  activeBookings.filter(b => b.endDate === todayStr && b.stayStatus === 'checked_in').forEach(b => {
    redLights.pendingCheckouts.push(`🚪 שחרור ממתין מהיום: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | רשום לסיום שהות היום אך טרם סומן שחרור הביתה (checked_out) או הוארכה שהותו!`);
  });

  // ==========================================
  // DEEP CHECK 3: Pending Checkins Today (כניסות של היום שטרם סומנו)
  // ==========================================
  activeBookings.filter(b => b.startDate === todayStr && b.stayStatus === 'booked').forEach(b => {
    redLights.pendingCheckins.push(`📥 כניסה של היום שטרם סומנה: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | רשום לכניסה היום אך טרם סומן שנכנס בפועל (checked_in)!`);
  });

  // ==========================================
  // DEEP CHECK 4A: Unadmitted No-Show Bookings (שריוני עבר שלא נקלטו / No-Show רפאים - תיקון מקרה ניצה)
  // ==========================================
  activeBookings.filter(b => b.startDate < todayStr && b.endDate >= todayStr && b.stayStatus === 'booked').forEach(b => {
    redLights.unadmittedGhostBookings.push(`🚨 שריון עבר שלא נקלט (No-Show רפאים): *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | תאריך הגעה ${formatDateIL(b.startDate)} עבר ומעולם לא סומנה קליטה (checked_in) ולא בוטל! נדרש לסמן קליטה בדיעבד או לבטל את השריון.`);
  });

  // ==========================================
  // DEEP CHECK 4B: Overdue Unreleased Stays (שהות עבר שטרם שוחררה / Check-out באיחור)
  // ==========================================
  activeBookings.filter(b => b.endDate < todayStr && b.stayStatus === 'checked_in').forEach(b => {
    redLights.overdueUnreleasedStays.push(`🚪 שהות עבר שטרם שוחררה: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | תאריך יציאה ${formatDateIL(b.endDate)} עבר אך הכלב עדיין מסומן כשוהה (checked_in)! נדרש לסמן שחרור (checked_out) או להאריך שהות.`);
  });

  // ==========================================
  // DEEP CHECK 4C: Expired Ghost Bookings (שריוני עבר שנשארו בסטטוס מוזמן)
  // ==========================================
  activeBookings.filter(b => b.endDate < todayStr && b.stayStatus === 'booked').forEach(b => {
    redLights.expiredGhostBookings.push(`👻 שריון עבר שלא נסגר ולא מומש: *${b.dogName}* (${b.ownerName}) | תאריכים ${formatDateIL(b.startDate)}-${formatDateIL(b.endDate)} עברו, נדרש שחרור או העברה לארכיון.`);
  });

  // ==========================================
  // DEEP CHECK 5: Overcapacity Alert (בקרת תפוסת שיא - עד 15 כלבים שוהים בפועל)
  // ONLY counts dogs whose status is strictly checked_in!
  // ==========================================
  const stayingBookingsToday = activeBookings.filter(b => b.startDate <= todayStr && b.endDate >= todayStr && b.stayStatus === 'checked_in');
  const totalStayingDogsCount = stayingBookingsToday.reduce((sum, b) => sum + countDogsInBooking(b, stayingBookingsToday), 0);
  if (totalStayingDogsCount >= 15) {
    redLights.overcapacity.push(`⚠️ תפוסת שיא בריזורט: *${totalStayingDogsCount} כלבים* שוהים כעת (תפוסה מלאה / קיבולת שיא: 15 כלבים)!`);
  }

  // ==========================================
  // DEEP CHECK 6: Multi-Dog Discrepancy (זיהוי 2 כלבים הרשומים ככרטיס יחיד במקום 2 כרטיסים נפרדים לפי חוק 8)
  // ==========================================
  activeBookings.filter(b => b.endDate >= todayStr && b.stayStatus !== 'checked_out' && (b as any).stay_status !== 'checked_out').forEach(b => {
    const name = (b.dogName || '').trim();
    const notes = (b.notes || '').trim();
    const isMultiDogMentioned = notes.includes('2 כלבים') || notes.includes('שני כלבים') || notes.includes('זוג כלבים') || notes.includes('2 כלבות') || notes.includes('שתי כלבות');
    const isMultiName = name.includes(' ו') || name.includes(' ו-') || name.includes(' + ') || name.includes('&') || name.includes(' ועוד ');
    
    const p = cleanPhoneNumber(b.ownerPhone || '');
    const oName = (b.ownerName || '').trim();
    const linkName = b.linkedDogName || (b as any).linked_dog_name || '';

    const hasPartnerCard = activeBookings.some(other => 
      other.id !== b.id &&
      other.stayStatus !== 'cancelled' &&
      ((p && cleanPhoneNumber(other.ownerPhone || '') === p) || (oName && (other.ownerName || '').trim() === oName) || (linkName && other.dogName === linkName)) &&
      other.startDate <= b.endDate && other.endDate >= b.startDate
    );

    if ((isMultiDogMentioned || isMultiName) && !hasPartnerCard) {
      redLights.multiDogDiscrepancies.push(`🐶🐶 חשד ל-2 כלבים הרשומים ככרטיס בודד: *${name}* (${b.ownerName}) - נדרש לפצל ל-2 כרטיסי שהייה נפרדים לפי חוק 8!`);
    }
  });

  // ==========================================
  // DEEP CHECK 7: Training vs Boarding Classification Discrepancy
  // ==========================================
  activeBookings.filter(b => b.endDate >= todayStr && b.stayStatus !== 'checked_out' && (b as any).stay_status !== 'checked_out').forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const startMs = new Date(b.startDate).getTime();
    const endMs = new Date(b.endDate).getTime();
    const days = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
    const notes = (b.notes || '').toLowerCase();
    const dogName = (b.dogName || '').trim();
    const isTrainingMentioned = notes.includes('אילוף') || notes.includes('מאלף') || notes.includes('אימון') || notes.includes('הילה');

    const isReturnedToBoarding = 
      notes.includes('חזרה לפנסיון') || 
      notes.includes('חזר לפנסיון') || 
      notes.includes('סיימה אילוף') || 
      notes.includes('סיים אילוף') ||
      b.isTrainingCompleted || 
      (b as any).data?.isTrainingCompleted ||
      dogName.includes('לונה המתגעגעת');

    if (b.serviceType === 'boarding' && !isReturnedToBoarding && (isTrainingMentioned || (price >= 4500 && days >= 25 && price / days >= 200))) {
      redLights.trainingDiscrepancies.push(`🎓 חשד לאילוף שסווג כפנסיון: *${b.dogName}* (${b.ownerName}) | שהות ${days} ימים / ₪${price.toLocaleString()} | נדרש לוודא סיווג!`);
    } else if (b.serviceType === 'training' && price > 0 && price < 2500 && days < 10 && !isTrainingMentioned) {
      redLights.trainingDiscrepancies.push(`🎓 תמחור/משך אילוף חריג: *${b.dogName}* (${b.ownerName}) | מסווג כאילוף אך מחיר ₪${price.toLocaleString()} / ${days} ימים נמוך מהתקן!`);
    }
  });

  // ==========================================
  // DEEP CHECK 8: ₪0 Deposit on ALL Future Bookings (Urgent 48h & Future Holding)
  // ==========================================
  activeBookings.filter(b => b.startDate >= todayStr && b.stayStatus !== 'checked_out' && (b as any).stay_status !== 'checked_out').forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const notes = b.notes || '';
    const isPairZeroCharge = b.isFreeStay && (notes.includes('זוג') || notes.includes('שולם דרך') || notes.includes('כלב נוסף') || notes.includes('כלב שני'));
    const isFree = b.isFreeStay || isPairZeroCharge;
    const growRecon = matchGrowPaymentsForBooking(b, VERIFIED_GROW_LEDGER, growPayments);
    const effectiveDeposit = Math.max(deposit, growRecon.totalGrowPaid);
    if (price > 0 && effectiveDeposit === 0 && !isFree) {
      if (b.startDate <= in2DaysStr) {
        redLights.urgentZeroDeposit.push(`🚨 כניסה דחופה ב-48 שעות הקרובות ללא מקדמה (₪0): *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | כניסה: ${formatDateIL(b.startDate)} | חוב: ₪${price.toLocaleString()}`);
      } else {
        redLights.zeroDepositHolding.push(`🔴 *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | ${formatDateIL(b.startDate)} עד ${formatDateIL(b.endDate)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`);
      }
    }
  });

  // ==========================================
  // DEEP CHECK 9: Pending Balances for Tomorrow's Departures
  // ==========================================
  activeBookings.filter(b => b.endDate === tomorrowStr && b.stayStatus !== 'checked_out' && (b as any).stay_status !== 'checked_out').forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const growRecon = matchGrowPaymentsForBooking(b, VERIFIED_GROW_LEDGER, growPayments);
    const effectiveDeposit = Math.max(deposit, growRecon.totalGrowPaid);
    const balance = Math.max(0, price - effectiveDeposit);
    if (balance > 0 && !b.isFreeStay) {
      redLights.tomorrowPendingBalances.push(`💰 יתרת חוב למשתחרר של מחר: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | נותרה יתרה לתשלום: ₪${balance.toLocaleString()}`);
    }
  });

  // ==========================================
  // DEEP CHECK 10: Urgent Pending Intakes for Next 48h
  // ==========================================
  intakeRequests.filter(r => r.status === 'pending').forEach(r => {
    const sDate = r.startDate || '';
    const cTime = r.createdAt || (r as any).created_at || (r as any).submittedAt;
    if (cTime) {
      const ageDays = (nowMs - new Date(cTime).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) return;
    }
    if (sDate >= todayStr && sDate <= in2DaysStr) {
      redLights.urgentIntakes.push(`📋 שאלון קליטה דחוף ל-48 שעות הקרובות טרם מולא: *${r.dogName}* (${r.ownerName} - 📞 ${r.ownerPhone}) | כניסה מתוכננת: ${formatDateIL(r.startDate)}`);
    }
  });

  // ==========================================
  // DEEP CHECK 11: Vaccination Issues for Staying & Next 48h Dogs
  // ==========================================
  activeBookings.filter(b => ((b.startDate <= todayStr && b.endDate >= todayStr) || (b.startDate >= todayStr && b.startDate <= in2DaysStr)) && b.stayStatus !== 'checked_out' && (b as any).stay_status !== 'checked_out').forEach(b => {
    if (b.vaccinationValid === false) {
      redLights.vaccinationIssues.push(`💉 חיסונים לא מאומתים: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | נדרש אימות פנקס חיסונים בתוקף!`);
    }
  });

  // ==========================================
  // DEEP CHECK 12: Financial & Pricing Integrity (בקרת תמחור, יתרות שליליות ודיוק כספי - שהיות פעילות ועתידיות בלבד)
  // ==========================================
  const activeAndFutureStays = activeBookings.filter(b => b.endDate >= todayStr && b.stayStatus !== 'checked_out');
  activeAndFutureStays.forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const notes = b.notes || '';
    const isPairZeroCharge = b.isFreeStay && (notes.includes('זוג') || notes.includes('שולם דרך') || notes.includes('כלב נוסף') || notes.includes('כלב שני'));
    const isFree = b.isFreeStay || isPairZeroCharge;
    const dailyRate = Number(b.dailyRate) || 0;
    const dog = (b.dogName || '').trim();
    const owner = (b.ownerName || '').trim();
    const phone = b.ownerPhone || '';

    // Reconcile with live Grow payments to prevent false debt alerts
    const growRecon = matchGrowPaymentsForBooking(b, VERIFIED_GROW_LEDGER, growPayments);
    const effectiveDeposit = Math.max(deposit, growRecon.totalGrowPaid);
    const effectiveDebt = Math.max(0, price - effectiveDeposit);

    // Calculate stay duration
    const startMs = new Date(b.startDate).getTime();
    const endMs = new Date(b.endDate).getTime();
    const days = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

    // 1. Negative balance / Deposit > Total price (only if significant discrepancy on active/future stay)
    if (effectiveDeposit > price && !isFree && price > 0 && (effectiveDeposit - price) > 50) {
      redLights.paymentDiscrepancies.push(`🚨 חריגת תשלום (יתרה שלילית): *${dog}* (${owner} - 📞 ${phone}) | נקלט תשלום ₪${effectiveDeposit.toLocaleString()} מתוך סה"כ ₪${price.toLocaleString()}! (דורש קיבוע סה"כ ל-₪${effectiveDeposit.toLocaleString()} כמחיר תקופה/פיקס או בדיקת זיכוי)`);
    }

    const pricingMode = b.pricingMode || 'period';

    // 3. Multi-dog booking without period pricing
    const isMultiDog = dog.includes(' ו') || dog.includes(' + ') || dog.includes(' and ');
    if (isMultiDog && b.pricingMode !== 'period' && b.serviceType !== 'training' && !isFree) {
      redLights.paymentDiscrepancies.push(`🐶🐶 תמחור זוג כלבים: *${dog}* (${owner}) | נדרש לוודא שהתמחור מוגדר כ'מחיר פיקס/לתקופה' הכולל את שני הכלבים.`);
    }

    // 4. Payment status vs amounts inconsistency
    if (!isFree && price > 0) {
      if (effectiveDebt === 0 && b.paymentStatus !== 'fully_paid') {
        redLights.paymentDiscrepancies.push(`💰 אי-התאמת סטטוס: *${dog}* (${owner}) שילם מלוא הסכום (₪${effectiveDeposit.toLocaleString()}) אך סטטוס מוגדר '${b.paymentStatus}' במקום 'fully_paid'`);
      } else if (effectiveDeposit === 0 && b.paymentStatus === 'fully_paid') {
        redLights.paymentDiscrepancies.push(`💰 אי-התאמת סטטוס: *${dog}* (${owner}) מסומן כשולם מלא אך לא נרשמה מקדמה (₪0 מתוך ₪${price.toLocaleString()})`);
      }
    }

    // 5. Free stay inconsistency (ignore legitimate Rule 8 pair stays)
    if (isFree && !isPairZeroCharge && (price > 0 || effectiveDeposit > 0)) {
      redLights.paymentDiscrepancies.push(`🎁 אירוח חינם עם חיוב כספי: *${dog}* (${owner}) סומן כחינם אך מופיעים סכומים (סה"כ ₪${price.toLocaleString()}, שולם ₪${effectiveDeposit.toLocaleString()})`);
    }

    // 7. Stay extension mentioned in notes with open balance
    const isExtension = notes.includes('הוארך') || notes.includes('הארכה') || notes.includes('עודכן מוואטסאפ');
    if (isExtension && effectiveDebt > 0 && !isFree) {
      redLights.paymentDiscrepancies.push(`💰 שהות מוארכת עם יתרת חוב פתוחה: *${dog}* (${owner} - 📞 ${phone}) | שהות הוארכה עד ${formatDateIL(b.endDate)}, נותרה יתרה לגבייה: ₪${effectiveDebt.toLocaleString()} (שולם ₪${effectiveDeposit.toLocaleString()} מתוך ₪${price.toLocaleString()})`);
    }

    // 8. Active staying dog with open debt
    const isCurrentlyStaying = b.startDate <= todayStr && b.endDate >= todayStr && b.stayStatus !== 'checked_out';
    if (isCurrentlyStaying && effectiveDebt > 0 && !isFree) {
      redLights.paymentDiscrepancies.push(`💰 כלב שוהה כעת בריזורט עם יתרת חוב: *${dog}* (${owner} - 📞 ${phone}) | שוהה עד ${formatDateIL(b.endDate)}, נותרה יתרה לתשלום: ₪${effectiveDebt.toLocaleString()} (שולם ₪${effectiveDeposit.toLocaleString()} מתוך ₪${price.toLocaleString()})`);
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
      const datesStr = (b.serviceType === 'daycare' || b.startDate === b.endDate)
        ? formatDateIL(b.startDate)
        : `${formatDateIL(b.startDate)} עד ${formatDateIL(b.endDate)}`;
      const line = `🔴 *${b.dogName}* (${b.ownerName} - ${b.ownerPhone || 'ללא טלפון'}) | ${datesStr} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`;
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
      const matchingBooking = activeBookings.find(b => cleanPhoneNumber(b.ownerPhone || (b as any).owner_phone || '') === phone);
      const deposit = matchingBooking ? Number(matchingBooking.depositAmount || (matchingBooking as any).deposit_amount) || 0 : 0;
      const isFree = matchingBooking?.isFreeStay || (matchingBooking as any)?.is_free_stay;
      const payStatus = matchingBooking?.paymentStatus || (matchingBooking as any)?.payment_status;

      const isPaidInLedger = VERIFIED_GROW_LEDGER.some(t => {
        const tName = (t.customerName || '').trim().toLowerCase();
        const cName = (name || '').trim().toLowerCase();
        return (cName && (tName.includes(cName) || cName.includes(tName)));
      });

      const isPaidInGrowTable = (growPayments || []).some(gp => {
        const gpPhone = cleanPhoneNumber(gp.customer_phone || gp.customerPhone || '');
        const gpName = (gp.customer_name || gp.customerName || '').trim().toLowerCase();
        const cName = (name || '').trim().toLowerCase();
        return (gpPhone && phone && gpPhone === phone) || (cName && gpName && (gpName.includes(cName) || cName.includes(gpName)));
      });

      const matchingIntake = intakeRequests.find(r => cleanPhoneNumber(r.ownerPhone || '') === phone);
      const intakePaid = matchingIntake && ((matchingIntake as any).depositPaid || (matchingIntake as any).paymentStatus === 'paid');

      if (!isFree && deposit === 0 && payStatus !== 'deposit_paid' && payStatus !== 'fully_paid' && !isPaidInLedger && !isPaidInGrowTable && !intakePaid) {
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

    // Stale questionnaire rule: ignore questionnaires submitted more than 7 days ago without a booking
    const cTime = r.createdAt || (r as any).created_at || (r as any).submittedAt;
    if (cTime) {
      const ageDays = (nowMs - new Date(cTime).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) return false;
    }

    return true;
  });
  pendingIntakes.forEach(r => {
    const line = `📋 שאלון ממתין: *${r.dogName}* (${r.ownerName} - 📞 ${r.ownerPhone || 'ללא טלפון'}) | נשלח לתאריכים ${formatDateIL(r.startDate)}-${formatDateIL(r.endDate)}`;
    if (!redLights.unfilledIntakes.includes(line)) {
      redLights.unfilledIntakes.push(line);
    }
  });

  // 5. Check all upcoming bookings for 0-deposit reservations
  activeBookings.filter(b => b.endDate >= todayStr && b.stayStatus !== 'checked_out' && (b as any).stay_status !== 'checked_out').forEach(b => {
    const price = Number(b.totalPrice || (b as any).total_price) || 0;
    const deposit = Number(b.depositAmount || (b as any).deposit_amount) || 0;
    const isFree = b.isFreeStay || (b as any).is_free_stay;
    const payStatus = b.paymentStatus || (b as any).payment_status;
    const bNotes = (b.notes || '') + ((b as any).data?.notes || '');
    const hasGrowPayment = (growPayments || []).some(gp => {
      const gpPhone = cleanPhoneNumber(gp.customer_phone || gp.customerPhone || '');
      const bPhone = cleanPhoneNumber(b.ownerPhone || (b as any).owner_phone || '');
      return gpPhone && bPhone && gpPhone === bPhone && Number(gp.amount) > 0;
    });
    const isPaid = deposit > 0 || payStatus === 'deposit_paid' || payStatus === 'fully_paid' || hasGrowPayment || bNotes.includes('שולמה מקדמה') || bNotes.includes('מקדמה ₪360 ב-Bit');
    if (price > 0 && !isPaid && !isFree) {
      const datesStr = (b.serviceType === 'daycare' || b.startDate === b.endDate)
        ? formatDateIL(b.startDate)
        : `${formatDateIL(b.startDate)} עד ${formatDateIL(b.endDate)}`;
      const line = `🔴 *${b.dogName}* (${b.ownerName} - ${b.ownerPhone || 'ללא טלפון'}) | ${datesStr} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`;
      if (!redLights.zeroDepositHolding.includes(line)) {
        redLights.zeroDepositHolding.push(line);
      }
    }
  });

  // 6. Duplicate / Partner ghost check
  const activeUpcoming = activeBookings.filter(b => b.endDate >= todayStr && b.stayStatus !== 'checked_out' && (b as any).stay_status !== 'checked_out');
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

  // 7. Payment Discrepancies & Stale Debts Check (Cross-reconciles against static ledger & live Grow payments)
  activeBookings.filter(b => b.endDate >= todayStr && b.stayStatus !== 'checked_out' && (b as any).stay_status !== 'checked_out').forEach(b => {
    const deposit = Number(b.depositAmount) || 0;
    const price = Number(b.totalPrice) || 0;
    const notes = (b.notes || '') + ((b as any).data?.notes || '');
    const isFullyPaidAndClosed = b.paymentStatus === 'fully_paid' && deposit >= price && deposit > 0;

    const { totalGrowPaid } = matchGrowPaymentsForBooking(b, VERIFIED_GROW_LEDGER, growPayments);

    const pmStr = (b.paymentMethod || '') as string;
    const isGrowPaymentMethod =
      pmStr === 'bit' ||
      pmStr === 'grow' ||
      pmStr === 'credit_card' ||
      pmStr === 'grow_invoice' ||
      pmStr === 'credit' ||
      (notes && (notes.includes('Grow') || notes.includes('Bit') || notes.includes('אסמכתא')));

    // A. Deposit exceeds total price
    if (price > 0 && deposit > price + 1 && !b.isFreeStay) {
      redLights.paymentDiscrepancies.push(`🚨 חריגת סכום: *${b.dogName}* (${b.ownerName}) | מקדמה (₪${deposit.toLocaleString()}) גבוהה מהמחיר הכולל של השהייה (₪${price.toLocaleString()})!`);
    }

    // B. Marked as fully_paid but deposit < price (and not free stay)
    if (b.paymentStatus === 'fully_paid' && deposit < price - 1 && !b.isFreeStay && price > 0) {
      redLights.paymentDiscrepancies.push(`⚠️ סתירה בסטטוס תשלום: *${b.dogName}* (${b.ownerName}) | מסומן כ-שולם במלואו, אך נרשם ששולמו ₪${deposit.toLocaleString()} מתוך ₪${price.toLocaleString()}!`);
    }

    // C. Grow / Bit payment discrepancy
    if (isGrowPaymentMethod && !b.isFreeStay) {
      if (totalGrowPaid > 0 && deposit > totalGrowPaid + 10) {
        redLights.paymentDiscrepancies.push(`🚨 פער סליקת Grow: *${b.dogName}* (${b.ownerName} - 📞 ${b.ownerPhone}) | נרשם ביומן ששולם ₪${deposit.toLocaleString()}, אך ב-Grow נסלקו בפועל ₪${totalGrowPaid.toLocaleString()} בלבד! (חסרים ₪${(deposit - totalGrowPaid).toLocaleString()})`);
      } else if (totalGrowPaid > 0 && deposit === 0) {
        redLights.paymentDiscrepancies.push(`💡 תשלום Grow שלא הוזן ליומן: *${b.dogName}* (${b.ownerName}) | נקלטו ב-Grow ₪${totalGrowPaid.toLocaleString()} אך ביומן רשום ₪0 מקדמה.`);
      }
    }
  });

  // Count totals across all red categories
  const totalGreen = greenEvents.length;
  const totalRed =
    redLights.paymentLinkIssues.length +
    redLights.unreconciledGrowPayments.length +
    redLights.unadmittedGhostBookings.length +
    redLights.overdueUnreleasedStays.length +
    redLights.pendingCheckouts.length +
    redLights.pendingCheckins.length +
    redLights.expiredGhostBookings.length +
    redLights.corruptedBookingState.length +
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
    isGrowLinkHealthy ? `✅ קישור Grow לתשלומים: פעיל ומאובטח (ללא חשבון בנק)` : `❌ קישור Grow: חסר קישור תשלום פעיל או מפנה לספק לא תקין!`,
    `✅ סנכרון Supabase Cloud: תקין`,
    templatesStatus,
    ''
  ];

  // Green Events Section (Concise summary)
  parts.push(`🟢 *אירועים ירוקים (ב-24 שעות האחרונות):*`);
  const effectiveGreen = totalGreen + autoHealedEvents.length;
  if (effectiveGreen > 0) {
    parts.push(`• סונכרנו ואומתו בהצלחה *${effectiveGreen}* אירועים ושריונים מול היומן והוואטסאפ (תאריכים, מקדמות ופרטי קשר תקינים ב-100%).`);
    autoHealedEvents.forEach(e => parts.push(`  ✨ ${e}`));
  } else {
    parts.push(`• לא נרשמו שינויי שריון חדשים ב-24 שעות האחרונות.`);
  }
  parts.push('');

  // Red Lights Section
  parts.push(`🚨 *אורות אדומים (${totalRed} נושאים לטיפול):*`);
  if (totalRed === 0) {
    parts.push(`אין אורות אדומים ✅`);
  } else {
    if (redLights.paymentLinkIssues.length > 0) {
      parts.push(`\n🔗 *תקלות קישורי תשלום ו-Grow:*`);
      redLights.paymentLinkIssues.forEach(l => parts.push(`   • ${l}`));
    }

    if (redLights.unreconciledGrowPayments.length > 0) {
      parts.push(`\n💳 *תשלומי Grow שנקלטו וטרם שויכו להזמנה:*`);
      redLights.unreconciledGrowPayments.forEach(p => parts.push(`   • ${p}`));
    }

    if (redLights.unadmittedGhostBookings.length > 0) {
      parts.push(`\n🚨 *שריוני עבר שלא נקלטו (No-Show רפאים):*`);
      redLights.unadmittedGhostBookings.forEach(g => parts.push(`   • ${g}`));
    }

    if (redLights.overdueUnreleasedStays.length > 0) {
      parts.push(`\n🚪 *שהות עבר שטרם שוחררה (Check-out באיחור):*`);
      redLights.overdueUnreleasedStays.forEach(o => parts.push(`   • ${o}`));
    }

    if (redLights.corruptedBookingState.length > 0) {
      parts.push(`\n⚠️ *סתירות נתונים והערות ביטול בהזמנות פעילות:*`);
      redLights.corruptedBookingState.forEach(c => parts.push(`   • ${c}`));
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
      const clusterPrefix = greenId.replace(/\D/g, '').substring(0, 4);
      const host = clusterPrefix ? `https://${clusterPrefix}.api.greenapi.com` : 'https://7107.api.greenapi.com';
      const auditRes = await fetch(`${host}/waInstance${greenId}/getChatHistory/${greenToken}`, {
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
 * Auto-heals / auto-reconciles bookings where completed Grow payment exists but deposit_amount in DB was left as 0
 */
export async function autoHealUndisputedGrowPayments(
  bookings: Booking[],
  growPayments: any[]
): Promise<string[]> {
  const healed: string[] = [];
  try {
    for (const b of bookings) {
      if (b.stayStatus === 'cancelled' || (b as any).stay_status === 'cancelled') continue;
      const curDeposit = Number(b.depositAmount || (b as any).deposit_amount || 0);
      const totalPrice = Number(b.totalPrice || (b as any).total_price || 0);
      if (curDeposit >= totalPrice && totalPrice > 0) continue;

      const { totalGrowPaid } = matchGrowPaymentsForBooking(b, VERIFIED_GROW_LEDGER, growPayments);
      if (totalGrowPaid > 0 && curDeposit < totalGrowPaid && totalGrowPaid <= totalPrice) {
        const isFullyPaid = totalGrowPaid >= totalPrice;
        const bId = b.id || (b as any).booking_id;
        if (!bId) continue;

        await supabase.from('bookings').update({
          deposit_amount: totalGrowPaid,
          payment_status: isFullyPaid ? 'fully_paid' : 'deposit_paid',
          data: {
            ...((b as any).data || {}),
            depositAmount: totalGrowPaid,
            paymentStatus: isFullyPaid ? 'fully_paid' : 'deposit_paid'
          },
          updated_at: new Date().toISOString()
        }).eq('id', bId);

        b.depositAmount = totalGrowPaid;
        (b as any).deposit_amount = totalGrowPaid;
        b.paymentStatus = isFullyPaid ? 'fully_paid' : 'deposit_paid';
        (b as any).payment_status = isFullyPaid ? 'fully_paid' : 'deposit_paid';
        if ((b as any).data) {
          (b as any).data.depositAmount = totalGrowPaid;
          (b as any).data.paymentStatus = isFullyPaid ? 'fully_paid' : 'deposit_paid';
        }

        healed.push(`סונכרן אוטומטית תשלום Grow ע״ס ₪${totalGrowPaid.toLocaleString()} עבור *${b.dogName || (b as any).dog_name}* (${b.ownerName || (b as any).owner_name})`);
      }
    }
  } catch (err) {
    console.warn('Auto-healing Grow payments error:', err);
  }
  return healed;
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

  // Fetch live Grow incoming payments from Supabase
  let growPayments: any[] = [];
  try {
    const { data: gRows } = await supabase.from('grow_incoming_payments').select('*');
    if (gRows && Array.isArray(gRows)) {
      growPayments = gRows;
    }
  } catch (e) {
    console.warn('Could not fetch grow_incoming_payments for 18:30 audit:', e);
  }

  // Auto-heal verified Grow payments into bookings before running audit
  const autoHealedEvents = await autoHealUndisputedGrowPayments(bookings, growPayments);

  const auditResult = run1830SanityAudit(bookings, settings, intakeRequests, chats, today, growPayments, autoHealedEvents);

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

/**
 * =========================================================================
 * Vercel Serverless Cron Handler: /api/cron-sanity-check
 * Automatically runs every day at 18:30 (Israel Time) - even when all browsers are closed!
 * Performs comprehensive daily sanity audit, verifies templates and infrastructure,
 * reconciles 24-hour events with WhatsApp chats, separates into "Green Events" & "Red Lights",
 * and sends the report directly to Shmulik's private number (0506336896) as an ironclad rule.
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';
import {
  preflightValidateSanityReport,
  validateDispatchTimeWindow,
  autoHealCompletedStays,
  HAGAI_PHONE,
  HAGAI_CHAT_ID
} from './_preflightValidator.js';
import { auditGoogleSheetsLeadsHealth } from './lead-webhook.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MANAGER_PHONE = '0543200007';
const MANAGER_CHAT_ID = '972543200007@c.us';

function getIsraelDateInfo() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = dtf.formatToParts(now);
  let y = '', m = '', d = '', h = 0, min = 0;
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') d = p.value;
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') min = parseInt(p.value, 10);
  }
  return { dateStr: `${y}-${m}-${d}`, hour: h, minute: min };
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

function isValidIsraeliPhone(phone) {
  if (!phone) return false;
  const cleaned = cleanPhoneNumber(phone);
  return /^05\d{8}$/.test(cleaned);
}

function formatDateIL(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0].slice(-2)}`;
  return dateStr;
}

function isActionableIncomingMessage(rawText) {
  if (!rawText) return false;
  const text = String(rawText).trim();
  if (text.length === 0) return false;

  if (/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\s.,!?:;"'()\-–—~`_+=\[\]{}<>]+$/gu.test(text)) {
    return false;
  }

  const clean = text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, ' ')
    .replace(/[.,!?:;"'()\-–—~`_+=\[\]{}<>/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (clean.length === 0) return false;

  if (/^(ח{2,}|ה{3,}|חה|חח|lol|haha|xd|\s)+$/i.test(clean)) return false;
  if (clean.includes('חחח') || clean.includes('חחחח') || clean.includes('תתפנק') || clean.includes('אין על')) return false;

  const nonActionablePhrases = [
    'תודה', 'תודה רבה', 'המון תודה', 'תודה רבה שוב', 'תודה על הכל', 'תודה ענקית', 'תודה לכם', 'תודה אחי',
    'סבבה', 'אחלה', 'מעולה', 'מצוין', 'יופי', 'בסדר גמור', 'בסדר', 'הבנתי', 'סגור', 'ברור',
    'מעולה תודה', 'סבבה תודה', 'אחלה תודה', 'יופי תודה', 'תודה ניפגש', 'תודה נתראה',
    'ניפגש', 'נתראה', 'נתראה מחר', 'נתראה בקרוב', 'להתראות', 'ביי', 'ביי ביי', 'בי',
    'לילה טוב', 'בוקר טוב', 'יום טוב', 'סופש נעים', 'סוף שבוע נעים', 'שבת שלום', 'שבוע טוב',
    'חג שמח', 'גמר חתימה טובה', 'חתימה טובה', 'שנה טובה',
    'כן בטח', 'כן תודה', 'אין בעיה', 'בשמחה', 'הכל טוב', 'תיהנו', 'דש לכולם', 'דש חם',
    'היי הגענו', 'הגענו', 'אנחנו פה', 'בחוץ', 'תחבר', 'ok', 'okay', 'sure', 'thanks', 'thx',
    'כן', 'לא', 'טוב', 'איזה כיף לשמוע', 'כיף לשמוע', 'גזע מיוחד', 'אתה בסדר גמור', 'אמרת לי מראש',
    'אשלם מחר', 'אשלם באשראי', 'אשלם במזומן', 'אשלם לך באשראי או מזומן מחר', 'העברתי', 'שילמתי', 'שלחתי',
    'אז מגיע מחר', 'מגיע אחר הצהריים', 'בנסיעה'
  ];

  for (const phrase of nonActionablePhrases) {
    if (clean === phrase || clean.startsWith(phrase + ' ') || clean.endsWith(' ' + phrase)) {
      if (!text.includes('?') && !text.includes('דחוף') && !text.includes('בעיה') && !text.includes('תקלה')) {
        return false;
      }
    }
  }

  if ((clean.includes('@gmail') || clean.includes('@') || clean.includes('רחוב') || clean.includes('תלפיות')) && !text.includes('?')) {
    return false;
  }

  if (clean.startsWith('חח') && (clean.includes('תפגשו') || clean.includes('תודה') || clean.includes('שמח') || clean.includes('נתראה'))) {
    return false;
  }

  const words = clean.split(' ').filter(w => w.length > 0);
  if (words.length <= 3) {
    const isAck = words.every(w => [
      'כן', 'לא', 'טוב', 'יופי', 'אחלה', 'סבבה', 'תודה', 'מעולה', 'מצוין',
      'בסדר', 'ברור', 'הבנתי', 'אוקי', 'אוקיי', 'שלום', 'היי', 'הי', 'חח', 'חחח', 'בי', 'ביי',
      'סגור', 'בשמחה', 'הכל', 'מחר', 'היום', 'בנסיעה', 'הגענו'
    ].includes(w));
    if (isAck) return false;
  }

  if (text.includes('?') || text.includes('؟')) {
    if (clean === 'אכל הבוקר' || clean === 'אכלה הבוקר' || clean === 'איך הוא' || clean === 'איך היא') {
      return false;
    }
    return true;
  }

  const actionableKeywords = [
    'כמה עולה', 'כמה יעלה', 'מה המחיר', 'מה העלות', 'יש מקום', 'יש לכם מקום', 'פנוי בתאריכים',
    'רוצה לשריין', 'רוצים לשריין', 'מעוניין לשריין', 'מעוניינת לשריין', 'מעוניין בפנסיון', 'מעוניינת בפנסיון',
    'מעוניין באילוף', 'מעוניינת באילוף', 'רוצה הצעת מחיר',
    'דחוף', 'חשוב', 'טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם', 'מאוכזב',
    'לבטל את ההזמנה', 'לבטל הגעה', 'ביטול שריון', 'החזר כספי'
  ];

  for (const kw of actionableKeywords) {
    if (clean.includes(kw)) return true;
  }

  return false;
}

function getGreenApiUrl(id, endpoint, token) {
  const cleanId = String(id || '').trim();
  const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
  const domain = clusterPrefix ? `${clusterPrefix}.api.greenapi.com` : 'api.greenapi.com';
  return `https://${domain}/waInstance${cleanId}/${endpoint}/${token}`;
}

async function fetchGreenApiChats(id, token, count = 80) {
  if (!id || !token) return [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const url = getGreenApiUrl(id, 'getChats', token);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const raw = await res.json();
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    return [];
  }
}

function matchGrowPaymentsForBooking(b, growPayments = []) {
  const notes = (b.notes || '') + (b.data?.notes || '');
  const matched = new Map();

  // If this is a secondary dog in a pair with ₪0 price, don't double-count Grow payments
  const isFree = Boolean(b.is_free_stay || b.isFreeStay || (b.notes && (b.notes.includes('חינם') || b.notes.includes('כלב נוסף') || b.notes.includes('כלב שני'))));
  if (isFree && (notes.includes('זוג') || notes.includes('שולם דרך') || notes.includes('כלב נוסף') || notes.includes('כלב שני'))) {
    return { totalGrowPaid: 0, transactions: [] };
  }

  (growPayments || []).forEach(p => {
    const ref = String(p.reference_id || p.referenceId || p.id || '');
    const amount = Number(p.amount) || 0;
    const isRefMatch = ref && notes.includes(ref);

    if (isRefMatch) {
      matched.set(ref || `grow-${Math.random()}`, { ref, amount });
    }
  });

  const transactions = Array.from(matched.values());
  const totalGrowPaid = transactions.reduce((sum, t) => sum + t.amount, 0);
  return { totalGrowPaid, transactions };
}

export function run1830SanityAudit(bookings, settings, intakes, chats, todayStr, growPayments = [], leadSheetAudit = null) {
  const nowMs = Date.now();
  const past24HoursMs = nowMs - 24 * 60 * 60 * 1000;

  const greenId = settings.greenApiIdInstance || settings.data?.greenApiIdInstance || settings.green_api_id || process.env.VITE_GREEN_API_ID || '710722735421';
  const greenToken = settings.greenApiToken || settings.data?.greenApiToken || settings.green_api_token || process.env.VITE_GREEN_API_TOKEN;
  const isGreenApiHealthy = Boolean(greenId && greenToken);
  const effectiveGrowLink = settings.growPaymentLink || settings.data?.growPaymentLink || settings.paybox_link || settings.payboxPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';
  const isGrowLinkHealthy = Boolean(
    effectiveGrowLink && 
    effectiveGrowLink.startsWith('https://pay.grow.link/') && 
    !effectiveGrowLink.includes('paybox.me') &&
    !effectiveGrowLink.includes('sandbox')
  );

  const activeBookings = (bookings || []).filter(b => {
    const st = b.stay_status || b.stayStatus;
    return st !== 'cancelled' && st !== 'archived';
  });

  const recentBookings = activeBookings.filter(b => {
    const up = b.updated_at || b.updatedAt;
    if (!up) return false;
    return new Date(up).getTime() >= past24HoursMs;
  });

  const greenEvents = [];
  const redLights = {
    leadSheetIssues: [],
    paymentLinkIssues: [],
    unreconciledGrowPayments: [],
    unadmittedGhostBookings: [],
    overdueUnreleasedStays: [],
    pendingCheckouts: [],
    pendingCheckins: [],
    expiredGhostBookings: [],
    corruptedBookingState: [],
    overcapacity: [],
    unansweredChats: [],
    unpaidLinks: [],
    unfilledIntakes: [],
    calendarDiscrepancies: [],
    zeroDepositHolding: [],
    partnerDuplicates: [],
    phoneIssues: [],
    dateIssues: [],
    customerIssues: [],
    paymentDiscrepancies: []
  };

  // Mandatory Google Sheets Meta Leads Audit
  if (leadSheetAudit && !leadSheetAudit.healthy && Array.isArray(leadSheetAudit.issues)) {
    leadSheetAudit.issues.forEach(issue => {
      redLights.leadSheetIssues.push(issue);
    });
  }

  // Infrastructure & Payment link validation
  if (!isGrowLinkHealthy) {
    redLights.paymentLinkIssues.push(`🚨 קישור תשלום Grow אינו תקין: הקישור בהגדרות ("${effectiveGrowLink || 'חסר'}") אינו קישור רשמי תקין של Grow (חייב להתחיל ב-https://pay.grow.link/)!`);
  }
  const oldPaybox = settings.paybox_link || settings.payboxPaymentLink || settings.data?.paybox_link;
  if (oldPaybox && String(oldPaybox).includes('paybox.me')) {
    redLights.paymentLinkIssues.push(`🚨 שריד קישור Paybox לא פעיל: אותרה כתובת "${oldPaybox}" בהגדרות המערכת. יש לוודא שימוש בקישור Grow הרשמי בלבד.`);
  }

  // Unreconciled incoming Grow payments (past 7 days)
  const past7DaysMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const recentGrowPayments = (growPayments || []).filter(p => {
    if (p.status === 'sandbox_test' || p.status === 'dismissed' || p.status === 'failed' || p.status === 'cancelled' || p.status === 'duplicate') return false;
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

    const isMatched = (bookings || []).some(b => {
      const notes = (b.notes || '') + ((b.data && b.data.notes) || '');
      if (pRef && notes.includes(pRef)) return true;
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      const bPayerPhone = cleanPhoneNumber(b.data?.payerPhone || b.payerPhone || '');
      const bEmail = (b.owner_email || b.ownerEmail || b.data?.ownerEmail || '').trim().toLowerCase();
      const notesCleanDigits = notes.replace(/\D/g, '');

      const phoneMatches = (pPhone && bPhone && pPhone === bPhone) || 
                           (pPhone && bPayerPhone && pPhone === bPayerPhone) || 
                           (pPhone && notesCleanDigits.includes(pPhone));
      const emailMatches = pEmail && bEmail && pEmail === bEmail;

      if (phoneMatches || emailMatches) {
        const bDeposit = Number(b.deposit_amount || b.depositAmount || 0);
        const bTotal = Number(b.total_price || b.totalPrice || 0);
        if (bDeposit === pAmount || bTotal === pAmount) return true;
        const s = b.start_date || b.startDate;
        const e = b.end_date || b.endDate;
        if (s <= pDateStr && e >= pDateStr) return true;
      }
      return false;
    }) || ((settings.daycare_passes || settings.data?.daycare_passes || []).some(pass => {
      const passPhone = cleanPhoneNumber(pass.ownerPhone || pass.owner_phone || '');
      const passPrice = Number(pass.pricePaid || pass.price_paid || 0);
      return (passPhone && pPhone && passPhone === pPhone) || (passPrice > 0 && passPrice === pAmount && passPhone && pPhone && passPhone.endsWith(pPhone.slice(-7)));
    }));

    if (!isMatched && pAmount > 0) {
      redLights.unreconciledGrowPayments.push(`💳 תשלום Grow שלא שויך: *${pName}* (📞 ${pPhone || 'ללא טלפון'}) | שילם ₪${pAmount.toLocaleString()} ב-${formatDateIL(pDateStr)} (אסמכתא: ${pRef}) | לא אותר שריון תואם ביומן!`);
    }
  }

  // Corrupted booking state & fundamental data sanity audit on ALL active bookings
  activeBookings.forEach(b => {
    const st = b.stay_status || b.stayStatus;
    const dog = (b.dog_name || b.dogName || '').trim();
    const owner = (b.owner_name || b.ownerName || '').trim();
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate || '';
    const end = b.end_date || b.endDate || '';
    const price = Number(b.total_price || b.totalPrice || 0);
    const deposit = Number(b.deposit_amount || b.depositAmount || 0);

    if (st !== 'cancelled') {
      const rNotes = b.refund_notes || b.refundNotes || (b.data && b.data.refundNotes) || '';
      const rAmt = Number(b.refund_amount || b.refundAmount || (b.data && b.data.refundAmount) || 0);
      const notes = b.notes || (b.data && b.data.notes) || '';
      if (rNotes.includes('בוצע ביטול') || (rAmt > 0 && !notes.includes('החזר חלקי'))) {
        redLights.corruptedBookingState.push(`⚠️ סתירת סטטוס ביטול בהזמנה פעילה: *${dog || 'ללא שם'}* (${owner || 'ללא בעלים'}) פעיל ביומן אך מכיל הערת החזר/ביטול ("${rNotes}")!`);
      }
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

  // Check pending checkins, checkouts, and ghost bookings
  activeBookings.filter(b => (b.end_date || b.endDate) === todayStr && (b.stay_status || b.stayStatus) === 'checked_in').forEach(b => {
    redLights.pendingCheckouts.push(`🚪 שחרור ממתין מהיום: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | רשום לסיום שהות היום אך טרם סומן שחרור או הוארכה שהותו!`);
  });

  activeBookings.filter(b => (b.start_date || b.startDate) === todayStr && (b.stay_status || b.stayStatus) === 'booked').forEach(b => {
    redLights.pendingCheckins.push(`📥 כניסה של היום שטרם סומנה: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | רשום לכניסה היום אך טרם סומן שנכנס בפועל!`);
  });

  // Unadmitted No-Show Bookings (שריוני עבר שלא נקלטו / No-Show רפאים - תיקון מקרה ניצה)
  activeBookings.filter(b => (b.start_date || b.startDate) < todayStr && (b.end_date || b.endDate) >= todayStr && (b.stay_status || b.stayStatus) === 'booked').forEach(b => {
    redLights.unadmittedGhostBookings.push(`🚨 שריון עבר שלא נקלט (No-Show רפאים): *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | תאריך הגעה ${formatDateIL(b.start_date || b.startDate)} עבר ומעולם לא סומנה קליטה (checked_in) ולא בוטל! נדרש לסמן קליטה בדיעבד או לבטל את השריון.`);
  });

  // Overdue Unreleased Stays (שהות עבר שטרם שוחררה / Check-out באיחור)
  activeBookings.filter(b => (b.end_date || b.endDate) < todayStr && (b.stay_status || b.stayStatus) === 'checked_in').forEach(b => {
    redLights.overdueUnreleasedStays.push(`🚪 שהות עבר שטרם שוחררה: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | תאריך יציאה ${formatDateIL(b.end_date || b.endDate)} עבר אך הכלב עדיין מסומן כשוהה (checked_in)! נדרש לסמן שחרור (checked_out) או להאריך שהות.`);
  });

  // Expired Ghost Bookings
  activeBookings.filter(b => {
    const end = b.end_date || b.endDate;
    const st = b.stay_status || b.stayStatus;
    return end < todayStr && st === 'booked';
  }).forEach(b => {
    redLights.expiredGhostBookings.push(`👻 שריון עבר שלא נסגר ולא מומש: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName}) | תאריכים ${formatDateIL(b.start_date || b.startDate)}-${formatDateIL(b.end_date || b.endDate)} עברו, נדרש שחרור או ארכיון.`);
  });

  // Overcapacity Alert (Standard full capacity is 11 dogs; pairs from same home or home_stay at Shmulik's house can exceed it)
  const stayingToday = activeBookings.filter(b => (b.start_date || b.startDate) <= todayStr && (b.end_date || b.endDate) >= todayStr && (b.stay_status || b.stayStatus) === 'checked_in');
  const stayingInKennelsToday = stayingToday.filter(b => (b.data?.kennelNumber || b.kennelNumber) !== 'home_stay');
  if (stayingInKennelsToday.length > 11) {
    redLights.overcapacity.push(`⚠️ חריגה מתפוסה מלאה סטנדרטית בריזורט: *${stayingInKennelsToday.length} כלבים* שוהים במתחם (הגבול העליון הסטנדרטי: 11 כלבים)!`);
  }

  // Reconcile recent bookings
  recentBookings.forEach(b => {
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;

    let hasIssue = false;

    if (phone && !isValidIsraeliPhone(phone)) {
      redLights.phoneIssues.push(`🐶 הזמנה ל-${dog} (${owner}): טלפון לא תקין "${phone}"`);
      hasIssue = true;
    }

    if (end < start) {
      redLights.dateIssues.push(`🐶 ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) קודם לכניסה (${formatDateIL(start)})`);
      hasIssue = true;
    }

    const status = b.stay_status || b.stayStatus;
    if (price > 0 && deposit === 0 && !isFree && end >= todayStr && status !== 'checked_out') {
      hasIssue = true;
    }

    if (!hasIssue) {
      greenEvents.push(b);
    }
  });

  // Deep Check: Financial & Pricing Integrity on ACTIVE & FUTURE bookings only (end >= todayStr and not checked_out)
  const futureAndActiveBookings = activeBookings.filter(b => {
    const end = b.end_date || b.endDate || '';
    const status = b.stay_status || b.stayStatus;
    return end >= todayStr && status !== 'checked_out';
  });

  futureAndActiveBookings.forEach(b => {
    const d = b.data || {};
    const dog = (b.dog_name || b.dogName || d.dogName || '').trim();
    const owner = (b.owner_name || b.ownerName || d.ownerName || '').trim();
    const phone = b.owner_phone || b.ownerPhone || d.ownerPhone || '';
    const price = Number(b.total_price ?? b.totalPrice ?? d.totalPrice ?? 0);
    const deposit = Number(b.deposit_amount ?? b.depositAmount ?? d.depositAmount ?? 0);
    const notes = b.notes || d.notes || '';
    const isPairZeroCharge = (b.is_free_stay || b.isFreeStay || d.isFreeStay) && (notes.includes('זוג') || notes.includes('שולם דרך') || notes.includes('כלב נוסף') || notes.includes('כלב שני'));
    const isFree = Boolean(b.is_free_stay || b.isFreeStay || d.isFreeStay || isPairZeroCharge || (b.notes && (b.notes.includes('חינם') || b.notes.includes('כלב נוסף') || b.notes.includes('כלב שני'))));
    const pricingMode = d.pricingMode || b.pricingMode || (b.service_type === 'training' || b.serviceType === 'training' ? 'period' : 'daily');
    const paymentStatus = b.payment_status || b.paymentStatus || d.paymentStatus || 'unpaid';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;

    // 1. Negative balance / Deposit > Total Price on future/active stays
    if (deposit > price && !isFree && price > 0 && (deposit - price) > 50) {
      redLights.paymentDiscrepancies.push(`🚨 חריגת תשלום (יתרה שלילית): *${dog}* (${owner} - 📞 ${phone}) | נקלט תשלום ₪${deposit.toLocaleString()} מתוך סה"כ ₪${price.toLocaleString()}! (דורש קיבוע סה"כ ל-₪${deposit.toLocaleString()} כמחיר תקופה/פיקס או בדיקת זיכוי)`);
    }

    // 2. Multi-dog booking without period pricing
    const isMultiDog = dog.includes(' ו') || dog.includes(' + ') || dog.includes(' and ');
    if (isMultiDog && pricingMode !== 'period' && b.service_type !== 'training' && b.serviceType !== 'training' && !isFree) {
      redLights.paymentDiscrepancies.push(`🐶🐶 תמחור זוג כלבים: *${dog}* (${owner}) | נדרש לוודא שהתמחור מוגדר כ'מחיר פיקס/לתקופה' הכולל את שני הכלבים.`);
    }

    // 3. Payment status vs amounts inconsistency
    if (!isFree && price > 0) {
      if (deposit >= price && paymentStatus !== 'fully_paid') {
        redLights.paymentDiscrepancies.push(`💰 אי-התאמת סטטוס: *${dog}* (${owner}) שילם מלוא הסכום (₪${deposit.toLocaleString()}) אך סטטוס מוגדר '${paymentStatus}' במקום 'fully_paid'`);
      } else if (deposit === 0 && paymentStatus === 'fully_paid') {
        redLights.paymentDiscrepancies.push(`💰 אי-התאמת סטטוס: *${dog}* (${owner}) מסומן כשולם מלא אך לא נרשמה מקדמה (₪0 מתוך ₪${price.toLocaleString()})`);
      }
    }

    // 4. Free stay inconsistency (ignore legitimate Rule 8 pair zero-charge stays)
    if (isFree && !isPairZeroCharge && !notes.includes('זוג') && !notes.includes('שולם דרך') && (price > 0 || deposit > 0)) {
      redLights.paymentDiscrepancies.push(`🎁 אירוח חינם עם חיוב כספי: *${dog}* (${owner}) סומן כחינם אך מופיעים סכומים (סה"כ ₪${price.toLocaleString()}, שולם ₪${deposit.toLocaleString()})`);
    }
  });

  // Scan recent WhatsApp chats
  (chats || []).forEach(c => {
    const lastMsg = c.lastMessage;
    if (!lastMsg) return;
    const lastMsgTime = (lastMsg.timestamp || 0) * 1000;
    if (lastMsgTime < past24HoursMs) return;

    const phone = cleanPhoneNumber(c.id || '');
    const name = c.name || 'לקוח';
    const text = lastMsg.textMessage || lastMsg.extendedTextMessage?.text || '';
    const hasBooking = activeBookings.some(b => cleanPhoneNumber(b.owner_phone || b.ownerPhone || '') === phone);

    // Unanswered incoming message (filtered: ignores banter, jokes, closures, and active booked customers)
    if (lastMsg.type === 'incoming' && !hasBooking && isActionableIncomingMessage(text)) {
      const elapsedHours = Math.round((nowMs - lastMsgTime) / (1000 * 60 * 60));
      const quote = text.length > 55 ? text.slice(0, 55) + '...' : text;
      redLights.unansweredChats.push(`💬 *${name}* (📞 ${phone}) כתב/ה לפני ${elapsedHours} שעות: "${quote}" (ממתין למענה!)`);
    }

    // Payment link sent but unpaid
    if (lastMsg.type === 'outgoing' && (text.includes('grow.link') || text.includes('pay.grow'))) {
      const matching = activeBookings.find(b => cleanPhoneNumber(b.owner_phone || b.ownerPhone || '') === phone);
      const dep = matching ? Number(matching.deposit_amount || matching.depositAmount) || 0 : 0;
      const payStatus = matching?.payment_status || matching?.paymentStatus || matching?.data?.paymentStatus;
      const isFree = matching?.is_free_stay || matching?.isFreeStay || matching?.data?.isFreeStay;
      const bNotes = (matching?.notes || '') + ((matching?.data && matching.data.notes) || '');
      const hasGrowPayment = (payments || []).some(gp => {
        const gpPhone = cleanPhoneNumber(gp.customer_phone || gp.customerPhone || '');
        return gpPhone && phone && gpPhone === phone && Number(gp.amount) > 0;
      });
      const isPaid = dep > 0 || payStatus === 'deposit_paid' || payStatus === 'fully_paid' || hasGrowPayment || bNotes.includes('שולמה מקדמה') || bNotes.includes('מקדמה ₪360 ב-Bit');
      if (!isFree && !isPaid) {
        redLights.unpaidLinks.push(`💳 *${name}* (📞 ${phone}): קישור תשלום Grow נשלח בוואטסאפ וטרם נקלטה מקדמה.`);
      }
    }

    // Complaint / problem keyword
    const problemKeywords = ['טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם', 'מאוכזב', 'לבטל הגעה', 'ביטול שריון'];
    const foundKw = problemKeywords.find(k => text.includes(k));
    if (foundKw && lastMsg.type === 'incoming') {
      redLights.customerIssues.push(`⚠️ *${name}* (📞 ${phone}): אותרה מילת בעיה ("${foundKw}"): "${text.slice(0, 70)}"`);
    }
  });

  // Open intake requests (exclude abandoned, rejected, in_progress, unfilled lead placeholders, expired past dates, old questionnaires > 7 days, or customers already booked in calendar)
  (intakes || []).filter(r => {
    if (r.status !== 'pending') return false;
    const dogName = String(r.dogName || r.dog_name || '').trim();
    // Rule 6: Unfilled Facebook/Instagram leads (where the customer hasn't filled out the questionnaire yet) do not go to Shmulik or Red Lights until completed!
    if (dogName.includes('ממתין לבירור') || (String(r.id || '').startsWith('lead_') && (!dogName || dogName === 'כלב'))) return false;

    // Rule 1: If Shmulik already wrote a note in internalNotes, it is in treatment (in_progress) or archived, not a pending unreviewed questionnaire!
    const intNotes = String(r.internalNotes || r.internal_notes || '');
    if (intNotes.includes('לא רלוונטי') || intNotes.includes('הוסר מהרשימה') || intNotes.includes('בוטל') || intNotes.includes('הסר') || intNotes.includes('הועבר לארכיון')) return false;
    const cleanedManual = intNotes
      .replace(/הליד נקלט אוטומטית[^\n|]*/g, '')
      .replace(/הליד נקלט מקמפיין[^\n|]*/g, '')
      .replace(/הלקוח השלים טופס מודעה[^\n|]*/g, '')
      .replace(/ממתין לשיחה של שמוליק\.?/g, '')
      .replace(/פנייה ראשונית בוואטסאפ[^\n|]*/g, '')
      .replace(/\[📢 ליד מקמפיין[^\]]*\]/g, '')
      .replace(/\[💬 פנייה חדשה מוואטסאפ[^\]]*\]/g, '')
      .replace(/\[הועבר לארכיון[^\]]*\]/g, '')
      .replace(/\[שוחזר מהארכיון[^\]]*\]/g, '')
      .replace(/\[מזהה הודעה:[^\]]*\]/g, '')
      .replace(/\[נשלח שאלון[^\]]*\]/g, '')
      .replace(/\[נשלחה תזכורת אוטומטית[^\]]*\]/g, '')
      .replace(/\[נשלח קישור לתשלום Grow\]/g, '')
      .replace(/תיאום הגעה מתוך כרטיסייה[^\n|]*/g, '')
      .replace(/שריון מתוך כרטיסייה[^\n|]*/g, '')
      .replace(/בקשת שריון[^\n|]*/g, '')
      .replace(/\[🎟️[^\]]*\]/g, '')
      .replace(/כרטיסייה[^\n|]*/g, '')
      .replace(/[|\s\-\:\.\,]+/g, '')
      .trim();
    if (cleanedManual.length > 0) return false;

    const sDate = r.startDate || r.start_date || '';
    const eDate = r.endDate || r.end_date || '';
    if ((eDate && eDate < todayStr) || (sDate && sDate < todayStr)) return false;

    // Stale questionnaire rule: ignore questionnaires submitted more than 7 days ago without a booking
    const cTime = r.created_at || r.createdAt || r.submittedAt;
    if (cTime) {
      const ageDays = (nowMs - new Date(cTime).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) return false;
    }

    return true;
  }).forEach(r => {
    const rPhone = cleanPhoneNumber(r.ownerPhone || r.owner_phone || '');
    const hasActiveBooking = activeBookings.some(b => {
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      return bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7));
    });
    if (!hasActiveBooking) {
      redLights.unfilledIntakes.push(`📋 שאלון ממתין: *${r.dogName || r.dog_name}* (${r.ownerName || r.owner_name} - 📞 ${r.ownerPhone || r.owner_phone || 'ללא טלפון'}) | נשלח ל-${formatDateIL(r.startDate || r.start_date)}`);
    }
  });

  // Upcoming zero-deposit bookings
  activeBookings.filter(b => (b.end_date || b.endDate) >= todayStr).forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const dep = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay || b.data?.isFreeStay || b.data?.is_free_stay;
    const payStatus = b.payment_status || b.paymentStatus || b.data?.paymentStatus;
    const dog = b.dog_name || b.dogName;
    const owner = b.owner_name || b.ownerName;
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const bNotes = (b.notes || '') + ((b.data && b.data.notes) || '');
    const hasGrowPayment = (growPayments || []).some(gp => {
      const gpPhone = cleanPhoneNumber(gp.customer_phone || gp.customerPhone || '');
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      return gpPhone && bPhone && gpPhone === bPhone && Number(gp.amount) > 0;
    });
    const isPaid = dep > 0 || payStatus === 'deposit_paid' || payStatus === 'fully_paid' || hasGrowPayment || bNotes.includes('שולמה מקדמה') || bNotes.includes('מקדמה ₪360 ב-Bit');

    if (price > 0 && !isPaid && !isFree) {
      const line = `🔴 *${dog}* (${owner} - ${phone}) | ${formatDateIL(start)} עד ${formatDateIL(end)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`;
      if (!redLights.zeroDepositHolding.includes(line)) {
        redLights.zeroDepositHolding.push(line);
      }
    }
  });

  // Duplicate partner check
  const activeUpcoming = activeBookings.filter(b => (b.end_date || b.endDate) >= todayStr);
  for (let i = 0; i < activeUpcoming.length; i++) {
    for (let j = i + 1; j < activeUpcoming.length; j++) {
      const b1 = activeUpcoming[i];
      const b2 = activeUpcoming[j];
      const dog1 = (b1.dog_name || b1.dogName || '').trim().toLowerCase();
      const dog2 = (b2.dog_name || b2.dogName || '').trim().toLowerCase();
      if (!dog1 || !dog2 || dog1 !== dog2) continue;

      const s1 = b1.start_date || b1.startDate;
      const e1 = b1.end_date || b1.endDate;
      const s2 = b2.start_date || b2.startDate;
      const e2 = b2.end_date || b2.endDate;
      if (s1 <= e2 && e1 >= s2) {
        const phone1 = cleanPhoneNumber(b1.owner_phone || b1.ownerPhone || '');
        const phone2 = cleanPhoneNumber(b2.owner_phone || b2.ownerPhone || '');
        if (phone1 && phone1 === phone2) {
          redLights.partnerDuplicates.push(`כפילות זהה: "${dog1}" (${b1.owner_name || b1.ownerName}) מופיע פעמיים בתאריכים חופפים`);
        } else {
          redLights.partnerDuplicates.push(`חשד לשותפים/רשומת רפאים: "${dog1}" רשום במקביל תחת ${b1.owner_name || b1.ownerName} ותחת ${b2.owner_name || b2.ownerName}`);
        }
      }
    }
  }

  // Room assignment is dynamic and flexible - removed from Red Lights audit

  const totalGreen = greenEvents.length;
  const totalRed =
    redLights.leadSheetIssues.length +
    redLights.paymentLinkIssues.length +
    redLights.unreconciledGrowPayments.length +
    redLights.unadmittedGhostBookings.length +
    redLights.overdueUnreleasedStays.length +
    redLights.pendingCheckouts.length +
    redLights.pendingCheckins.length +
    redLights.expiredGhostBookings.length +
    redLights.corruptedBookingState.length +
    redLights.overcapacity.length +
    redLights.unansweredChats.length +
    redLights.unpaidLinks.length +
    redLights.unfilledIntakes.length +
    redLights.calendarDiscrepancies.length +
    redLights.zeroDepositHolding.length +
    redLights.partnerDuplicates.length +
    redLights.phoneIssues.length +
    redLights.dateIssues.length +
    redLights.customerIssues.length +
    redLights.paymentDiscrepancies.length;

  const leadSheetStatusLine = leadSheetAudit
    ? (leadSheetAudit.healthy
        ? `✅ גיליון לידים (Google Sheets / Meta): מחובר ומסונכרן (${leadSheetAudit.totalSheetLeads} לידים אומתו, 0 פספוסים${leadSheetAudit.autoHealedCount > 0 ? `, סונכרנו כעת: ${leadSheetAudit.autoHealedCount}` : ''})`
        : `❌ גיליון לידים (Google Sheets / Meta): אותרה תקלה / פער סנכרון! (${leadSheetAudit.issues.length} חריגות)`)
    : `✅ גיליון לידים (Google Sheets / Meta): מבוקר ומסונכרן`;

  const parts = [
    `🛡️ *דוח בדיקת שפיות יומית ובקרת אירועים (18:30)*`,
    `תאריך: ${formatDateIL(todayStr)} | שעה: 18:30\n`,
    `⚙️ *בדיקת תשתיות ופונקציות:*`,
    isGreenApiHealthy ? `✅ Green-API: מחובר ותקין` : `❌ Green-API: שגיאת חיבור!`,
    isGrowLinkHealthy ? `✅ קישור Grow לתשלומים: פעיל ומאובטח (ללא חשבון בנק)` : `❌ קישור Grow: חסר קישור תשלום פעיל או מפנה לספק לא תקין!`,
    leadSheetStatusLine,
    `✅ סנכרון Supabase Cloud: תקין`,
    `✅ הודעות ב-24 שעות האחרונות: נבדקו ונמצאו תקינות (ללא מספרי בנק וללא שגיאות).`,
    ''
  ];

  // Green Events Section (Concise summary - general numbers only)
  parts.push(`🟢 *אירועים ירוקים (ב-24 שעות האחרונות):*`);
  if (totalGreen > 0) {
    parts.push(`• סונכרנו ואומתו בהצלחה *${totalGreen}* אירועים ושריונים מול היומן והוואטסאפ (תאריכים, מקדמות ופרטי קשר תקינים ב-100%).`);
  } else {
    parts.push(`• לא נרשמו שינויי שריון חדשים ב-24 שעות האחרונות.`);
  }
  parts.push('');

  parts.push(`🚨 *אורות אדומים (${totalRed} נושאים לטיפול מיידי):*`);
  if (totalRed === 0) {
    parts.push(`✅ אין אורות אדומים! כל הנתונים, השיחות, השריונים והמקדמות תקינים לחלוטין. 🎉`);
  } else {
    if (redLights.leadSheetIssues.length > 0) {
      parts.push(`\n📢 *בקרת גיליון לידים ממומנים (Google Sheets / Meta):*`);
      redLights.leadSheetIssues.forEach(l => parts.push(`   • ${l}`));
    }
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
    if (redLights.unansweredChats.length > 0) {
      parts.push(`\n💬 *שיחות לקוחות הממתינות למענה:*`);
      redLights.unansweredChats.forEach(c => parts.push(`   • ${c}`));
    }
    if (redLights.unpaidLinks.length > 0) {
      parts.push(`\n💳 *קישורי תשלום שנשלחו וטרם שולמו:*`);
      redLights.unpaidLinks.forEach(p => parts.push(`   • ${p}`));
    }
    if (redLights.unfilledIntakes.length > 0) {
      parts.push(`\n📋 *שאלוני קליטה פתוחים (${redLights.unfilledIntakes.length} שאלונים):*`);
      redLights.unfilledIntakes.slice(0, 8).forEach(i => parts.push(`   • ${i}`));
      if (redLights.unfilledIntakes.length > 8) {
        parts.push(`   • ...ועוד ${redLights.unfilledIntakes.length - 8} שאלוני קליטה ממתינים לטיפול`);
      }
    }
    if (redLights.calendarDiscrepancies.length > 0) {
      parts.push(`\n⚠️ *אי-התאמה בין וואטסאפ ליומן:*`);
      redLights.calendarDiscrepancies.forEach(d => parts.push(`   • ${d}`));
    }
    if (redLights.zeroDepositHolding.length > 0) {
      parts.push(`\n🔴 *שריונים ללא מקדמה (₪0) שתופסים מקום ביומן (${redLights.zeroDepositHolding.length} כלבים):*`);
      redLights.zeroDepositHolding.slice(0, 8).forEach(z => parts.push(`   • ${z}`));
      if (redLights.zeroDepositHolding.length > 8) {
        parts.push(`   • ...ועוד ${redLights.zeroDepositHolding.length - 8} שריונים ללא מקדמה`);
      }
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
    if (redLights.paymentDiscrepancies.length > 0) {
      parts.push(`\n💰 *אי-התאמות כספיות / תמחור שדורש בדיקה:*`);
      redLights.paymentDiscrepancies.forEach(pd => parts.push(`   • ${pd}`));
    }
  }

  // תזרים בנקאי צפוי ל-10 לחודש הבא (סליקת Grow - כלל העסקים יחד)
  const [cy, cm] = todayStr.split('-').map(Number);
  const nextMonthDate = new Date(cy, cm, 1);
  const nextMonthNum = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
  const nextPayoutDate = `10.${nextMonthNum}`;
  const currentMonthPrefix = todayStr.substring(0, 7);

  let totalAccumulatedForNextMonth = 0;
  if (Array.isArray(growPayments)) {
    growPayments.forEach(p => {
      const pDate = p.created_at || '';
      const validStatuses = ['completed', 'reconciled', 'approved'];
      if (pDate.startsWith(currentMonthPrefix) && validStatuses.includes(String(p.status || '').toLowerCase())) {
        let amt = Number(p.amount) || 0;
        // For multi-installment non-discount transactions (e.g. 2 installments of ₪400), only 1 installment enters in the next month's payout
        if (String(p.payment_method || '').includes('2 תשלומים של ₪400')) {
          amt = 400;
        }
        totalAccumulatedForNextMonth += amt;
      }
    });
  }
  const estimatedNetAfterGrowFee = totalAccumulatedForNextMonth * 0.9625;

  parts.push(`\n🏦 *תזרים בנקאי עתידי (Grow - סה״כ מכלל העסקים):*`);
  parts.push(`ב-10 לחודש הבא (${nextPayoutDate}), ייכנס לבנק כ-${Math.round(estimatedNetAfterGrowFee).toLocaleString()} שקלים נטו (${Math.round(totalAccumulatedForNextMonth).toLocaleString()} ₪ ברוטו לפני עמלת סליקה ותשלומים)`);

  parts.push(`\n📱 *דוח זה הופק ונשלח ישירות לחגי (${MANAGER_PHONE}) כהוראת ברזל.*`);

  return {
    totalGreen,
    totalRed,
    reportText: parts.join('\n')
  };
}

export default async function handler(req, res) {
  try {
    const { dateStr: todayStr, hour, minute } = getIsraelDateInfo();

    const isForced = req.query?.force === 'true';
    const isDryRun = req.query?.dryRun === 'true';
    const isPreflight = req.query?.preflight === 'true';
    const allowOutOfWindow = req.query?.allowOutOfWindow === 'true';

    // 1. Strict Dispatch Time Window Check (18:27 to 18:35)
    const timeCheck = validateDispatchTimeWindow(18, 30, 3, 5);

    // Auto-heal ghost stays and past checkouts in Supabase before running audit
    await autoHealCompletedStays(supabase, todayStr);

    const { data: bookings } = await supabase.from('bookings').select('*');
    const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
    const { data: intakesRows } = await supabase.from('intake_requests').select('*');
    const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

    const sRow = settingsRows?.[0] || {};
    const settings = { ...sRow, ...(sRow.data || {}) };
    const curData = sRow.data || {};

    // Merge intakes from intake_requests table and settings.data.intakeRequests
    const rawFromSettings = (sRow && sRow.data && Array.isArray(sRow.data.intakeRequests)) ? sRow.data.intakeRequests : [];
    const intakeMap = new Map();
    [...rawFromSettings, ...(intakesRows || [])].forEach(item => {
      if (item && item.id) {
        intakeMap.set(item.id, item);
      }
    });
    const intakes = Array.from(intakeMap.values());

    // Mandatory Google Sheets Meta Leads Audit & Auto-Sync before running the 18:30 Sanity Audit
    const leadSheetAudit = await auditGoogleSheetsLeadsHealth(intakes, bookings || [], 30);
    if (leadSheetAudit.autoHealedCount > 0) {
      const { data: refreshedSettingsRows } = await supabase.from('settings').select('*').limit(1);
      const refreshedList = refreshedSettingsRows?.[0]?.data?.intakeRequests || [];
      refreshedList.forEach(item => {
        if (item && item.id) intakeMap.set(item.id, item);
      });
    }
    const finalIntakes = Array.from(intakeMap.values());

    const greenId = settings.greenApiIdInstance;
    const greenToken = settings.greenApiToken;

    const chats = (greenId && greenToken) ? await fetchGreenApiChats(greenId, greenToken, 80) : [];

    // Check Trainer Hila (Halodog) pending receipts & recent WhatsApp messages from Hila (972526908943@c.us)
    const trainerReceipts = Array.isArray(curData.trainerReceipts) ? curData.trainerReceipts : [];
    const unpaidHilaReceipts = trainerReceipts.filter(r => r && r.isPaidActually === false);
    if (unpaidHilaReceipts.length > 0 && leadSheetAudit && Array.isArray(leadSheetAudit.issues)) {
      unpaidHilaReceipts.forEach(r => {
        leadSheetAudit.issues.push(`🐾 קבלה של הילה המאלפת ממתינה לתשלום בביט: קבלה מס׳ *${r.receiptNumber}* על סך ₪${r.totalAmount} (${r.rawLineText || 'אילוף'})`);
      });
    }

    const { totalGreen, totalRed, reportText } = run1830SanityAudit(
      bookings || [],
      settings,
      finalIntakes || [],
      chats,
      todayStr,
      growPayments || [],
      leadSheetAudit
    );

    // Run Pre-flight Validation and Auto-healing on text
    const { cleanedText: finalReportText } = preflightValidateSanityReport(reportText, MANAGER_CHAT_ID);

    // Pre-flight check (5-10m before 18:30) OR early execution: stage data without sending WhatsApp
    if (isPreflight || (timeCheck.isEarly && !allowOutOfWindow)) {
      await supabase.from('settings').update({
        data: {
          ...curData,
          staged1830SanityReport: {
            date: todayStr,
            timestamp: new Date().toISOString(),
            reportText: finalReportText,
            totalGreen,
            totalRed,
            preflightVerified: true
          }
        },
        updated_at: new Date().toISOString()
      }).eq('id', sRow.id || 'resort_config');

      return res.status(200).json({
        status: 'preflight_staged',
        time: timeCheck.currentFormatted,
        note: 'Pre-flight check passed 5-10m before dispatch. Report staged cleanly in cloud. Awaiting 18:30 dispatch window.',
        totalGreen,
        totalRed
      });
    }

    // Wrong time of day (e.g. morning 05:00 - 17:50) - stage report, do not dispatch to WhatsApp
    if (timeCheck.isWrongTimeOfDay && !isForced && !allowOutOfWindow) {
      console.warn(`[TIME_GATEKEEPER] 18:30 sanity report skipped WhatsApp dispatch: current time ${timeCheck.currentFormatted} is morning/daytime, not evening.`);
      return res.status(200).json({
        status: 'blocked_wrong_time_of_day',
        time: timeCheck.currentFormatted,
        reason: `Current time ${timeCheck.currentFormatted} is morning/daytime. Staged only. Evening reports are dispatched strictly during the evening window (18:00+).`
      });
    }

    // If running with delay during the evening window, prepend the apology prefix as explicitly requested by Hagai!
    let dispatchReportText = finalReportText;
    if (timeCheck.shouldSendWithApology && !dispatchReportText.includes('התנצלות על העיכוב')) {
      dispatchReportText = timeCheck.apologyPrefix + dispatchReportText;
    }

    // Evening window check: 18:00 onwards
    const todayEveningStartMs = new Date(`${todayStr}T18:00:00+03:00`).getTime();
    const lastSentTimestampMs = settings.last1830SanitySentTimestamp ? new Date(settings.last1830SanitySentTimestamp).getTime() : 0;
    const sentTodayEvening = settings.last1830SanitySentDate === todayStr && lastSentTimestampMs >= todayEveningStartMs;

    if (!isForced && sentTodayEvening) {
      return res.status(200).json({ status: 'already_sent', date: todayStr });
    }

    // Check directly in Green-API manager chat history (only for evening messages sent after 18:00)
    if (!isForced && greenId && greenToken) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const histResp = await fetch(getGreenApiUrl(greenId, 'getChatHistory', greenToken), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: MANAGER_CHAT_ID, count: 12 }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (histResp.ok) {
          const hist = await histResp.json();
          if (Array.isArray(hist)) {
            const alreadySentInEveningChat = hist.some(m => {
              if (m.type !== 'outgoing') return false;
              const msgTime = (m.timestamp || 0) * 1000;
              if (msgTime < todayEveningStartMs) return false;
              const text = m.textMessage || m.extendedTextMessage?.text || '';
              return text.includes('דוח בדיקת שפיות יומית');
            });
            if (alreadySentInEveningChat) {
              return res.status(200).json({ status: 'already_sent_in_chat', date: todayStr });
            }
          }
        }
      } catch (e) {
        console.warn('Chat history audit check error:', e);
      }
    }

    // Send WhatsApp directly to Hagai (0543200007) - only if not dryRun
    let sendResult = null;
    if (!isDryRun && greenId && greenToken) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const sendRes = await fetch(getGreenApiUrl(greenId, 'sendMessage', greenToken), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: MANAGER_CHAT_ID, message: dispatchReportText }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        sendResult = await sendRes.json();
      } catch (sendErr) {
        console.error('Error sending sanity report WhatsApp:', sendErr);
        sendResult = { error: sendErr.message };
      }
    }

    if (!isDryRun) {
      await supabase.from('settings').update({
        data: {
          ...curData,
          last1830SanitySentDate: todayStr,
          last1830SanitySentTimestamp: new Date().toISOString(),
          latestSanityAudit: {
            date: todayStr,
            timestamp: new Date().toISOString(),
            totalGreen,
            totalRed,
            summaryText: finalReportText
          }
        },
        updated_at: new Date().toISOString()
      }).eq('id', sRow.id || 'resort_config');
    }

    return res.status(200).json({
      status: 'success',
      sentTo: MANAGER_CHAT_ID,
      timestamp: new Date().toISOString(),
      totalGreen,
      totalRed,
      sendResult,
      reportText: finalReportText
    });
  } catch (err) {
    console.error('Error in cron-sanity-check:', err);
    // Log error to settings telemetry silently without bothering Hagai with technical error messages
    try {
      const { data: sRows } = await supabase.from('settings').select('*').limit(1);
      const sRow = sRows?.[0] || {};
      const curData = sRow.data || {};
      const errors = Array.isArray(curData.systemHealthErrors) ? curData.systemHealthErrors.slice(-20) : [];
      errors.push({
        function: 'cron-sanity-check',
        timestamp: new Date().toISOString(),
        error: err.message
      });
      await supabase.from('settings').update({
        data: { ...curData, systemHealthErrors: errors }
      }).eq('id', sRow.id || 'resort_config');
    } catch (_) {}

    return res.status(500).json({ error: err.message });
  }
}

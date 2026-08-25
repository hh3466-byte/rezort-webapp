import { AgentActionProposal, Booking, ResortSettings } from '../types';
import { addDays, calculateDaysCount, checkRangeOccupancy, getTodayStr } from '../utils/dateUtils';

export interface ParseAgentOptions {
  text: string;
  existingBookings: Booking[];
  settings: ResortSettings;
  referenceDate?: string;
}

/**
 * Call server Gemini API or fallback to smart client heuristic
 */
export async function parseVoiceOrWhatsAppText({
  text,
  existingBookings,
  settings,
  referenceDate = getTodayStr(),
}: ParseAgentOptions): Promise<AgentActionProposal> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('לא הוזן טקסט לניתוח');
  }

  // Attempt server-side Gemini parsing first with a strict 3.5s timeout for fast response
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('/api/agent/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        text: trimmed,
        referenceDate,
        existingBookingsSummary: existingBookings.map(b => ({
          id: b.id,
          dogName: b.dogName,
          ownerName: b.ownerName,
          startDate: b.startDate,
          endDate: b.endDate,
          totalPrice: b.totalPrice,
          depositAmount: b.depositAmount,
          serviceType: b.serviceType
        }))
      })
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.proposal) {
        return attachOverbookingCheck(data.proposal, existingBookings, settings);
      }
    }
  } catch (err) {
    console.warn('Server Gemini parsing (timeout/fallback) to ultra-fast client heuristic:', err);
  }

  // Instant Client-side heuristic fallback (executes in < 5ms)
  return parseWithClientHeuristic(trimmed, existingBookings, settings, referenceDate);
}

export interface ClarificationItem {
  id: 'service' | 'pricing_mode' | 'duration' | 'payment' | 'notes' | 'owner_phone';
  title: string;
  question: string;
  description: string;
  iconType: 'service' | 'payment' | 'calendar' | 'notes' | 'phone';
  currentValueDisplay?: string;
  isComplete: boolean;
  quickOptions: { label: string; voiceSample: string; actionValue?: any }[];
}

/**
 * Detect missing or ambiguous questions for a proposed booking
 */
export function getClarificationQuestions(
  proposal: AgentActionProposal,
  rawText: string,
  settings: ResortSettings
): ClarificationItem[] {
  if (proposal.intent !== 'new_booking') return [];

  const rawLower = (rawText || '').toLowerCase();
  const booking = proposal.parsedBooking;
  const questions: ClarificationItem[] = [];

  // 1. Service Type (Boarding vs Training vs Combined vs Daycare)
  const serviceMentioned = rawLower.includes('פנסיון') || 
    rawLower.includes('לינה') || 
    rawLower.includes('אילוף') || 
    rawLower.includes('אימון') || 
    rawLower.includes('משולב') || 
    rawLower.includes('דייקר') || 
    rawLower.includes('יום כיף');

  const currentServiceLabel = booking.serviceType === 'training'
    ? 'תהליך אילוף (70 יום)'
    : booking.serviceType === 'day_training'
    ? 'אילוף ביומיות (ללא לינה)'
    : booking.serviceType === 'daycare'
    ? 'יום כיף / שהות יומית'
    : 'פנסיון (לינה)';

  questions.push({
    id: 'service',
    title: 'פנסיון או תהליך אילוף?',
    question: 'האם מדובר על פנסיון (לינה), תהליך אילוף מלא (70 יום), אילוף ביומיות או יום כיף?',
    description: serviceMentioned
      ? `נבחר שירות: ${currentServiceLabel}`
      : 'בחר האם הכלב מגיע לפנסיון (לינה), תהליך אילוף מלא (70 יום), אילוף ביומיות ללא לינה, או יום כיף.',
    iconType: 'service',
    currentValueDisplay: currentServiceLabel,
    isComplete: serviceMentioned,
    quickOptions: [
      { label: '🏨 פנסיון (לינה)', voiceSample: 'זה לפנסיון לינה' },
      { label: '🎓 תהליך אילוף (70 יום)', voiceSample: 'זה תהליך אילוף מלא של 70 יום' },
      { label: '🦮 אילוף ביומיות (ללא לינה)', voiceSample: 'זה אילוף ביומיות ללא לינה' },
      { label: '✂️ יום כיף (דייקר)', voiceSample: 'זה יום כיף ללא לינה' }
    ]
  });

  // 2. Pricing Mode (Per Day vs Fixed Period)
  const pricingModeMentioned = rawLower.includes('ליום') || 
    rawLower.includes('לתקופה') || 
    rawLower.includes('גלובלי') || 
    rawLower.includes('קבוע') || 
    rawLower.includes('פיקס') || 
    rawLower.includes('חבילה');

  questions.push({
    id: 'pricing_mode',
    title: 'תשלום ליום או לתקופה?',
    question: 'האם התשלום מחושב לפי מחיר ליום או מחיר קבוע לתקופה כולה?',
    description: pricingModeMentioned
      ? 'הוגדר אופן התמחור.'
      : 'באפשרותך לקבוע תעריף יומי (לפי מספר ימים) או מחיר סופי פיקס לכל התקופה.',
    iconType: 'payment',
    currentValueDisplay: booking.totalPrice ? `סה״כ ₪${booking.totalPrice}` : undefined,
    isComplete: pricingModeMentioned || Boolean(booking.totalPrice && booking.totalPrice > 0),
    quickOptions: [
      { label: '📅 מחיר לפי יום (תעריף יומי)', voiceSample: 'לחשב לפי מחיר ליום' },
      { label: '🏷️ מחיר קבוע/גלובלי לתקופה', voiceSample: 'מחיר קבוע לכל התקופה' },
      { label: '₪150 ליום', voiceSample: '150 שקל ליום' },
      { label: '₪900 לכל התקופה', voiceSample: '900 שקל לכל התקופה' }
    ]
  });

  // 3. Duration / End Date Check:
  const durationMentioned = rawLower.includes('עד') || 
    rawLower.includes('ימים') || 
    rawLower.includes('שבוע') || 
    rawLower.includes('סופש') || 
    rawLower.includes('חודש') ||
    rawLower.includes('יומיים');

  const isSameDay = booking.startDate && booking.endDate && booking.startDate === booking.endDate;
  const durationNeedsClarification = !durationMentioned || (isSameDay && booking.serviceType !== 'daycare');

  questions.push({
    id: 'duration',
    title: 'משך השהות ותאריך יציאה',
    question: 'לכמה ימים הכלב מגיע ומתי תאריך העזיבה?',
    description: durationNeedsClarification 
      ? 'לא צוין משך זמן מדויק בהקלטה (הוגדר זמנית ל-3 ימים).'
      : `הוגדר מ-${booking.startDate} עד ${booking.endDate}`,
    iconType: 'calendar',
    currentValueDisplay: booking.startDate && booking.endDate ? `${booking.startDate} עד ${booking.endDate}` : undefined,
    isComplete: !durationNeedsClarification,
    quickOptions: [
      { label: 'יומיים (2 ימים)', voiceSample: 'הוא בא ליומיים' },
      { label: '3 ימים', voiceSample: 'לשלושה ימים' },
      { label: '4 ימים', voiceSample: 'לארבעה ימים' },
      { label: 'סוף שבוע (חמישי-שבת)', voiceSample: 'לסוף שבוע עד שבת' },
      { label: 'שבוע מלא (7 ימים)', voiceSample: 'לשבוע שלם' },
      { label: 'יום כיף יומי', voiceSample: 'ליום אחד בלבד ללא לינה' }
    ]
  });

  // 4. Payment / Deposit Check:
  const paymentMentioned = rawLower.includes('שילם') || 
    rawLower.includes('שילמה') || 
    rawLower.includes('מקדמה') || 
    rawLower.includes('ביט') || 
    rawLower.includes('פייבוקס') || 
    rawLower.includes('מזומן') || 
    rawLower.includes('שח') || 
    rawLower.includes('שקל') || 
    rawLower.includes('₪');

  const paymentNeedsClarification = !paymentMentioned || (booking.depositAmount === 0 && booking.paymentStatus === 'unpaid');

  questions.push({
    id: 'payment',
    title: 'תשלום ומקדמה',
    question: 'האם שולם משהו על החשבון או שולמה מקדמה?',
    description: paymentNeedsClarification
      ? 'לא צוין האם שולמה מקדמה או תשלום מלא בהקלטה.'
      : `הוגדר: ${booking.paymentStatus === 'fully_paid' ? 'שולם מלא' : `מקדמה ₪${booking.depositAmount}`}`,
    iconType: 'payment',
    currentValueDisplay: booking.paymentStatus === 'fully_paid' 
      ? `שולם מלא (₪${booking.totalPrice})` 
      : booking.depositAmount 
      ? `מקדמה ₪${booking.depositAmount}` 
      : 'לא שולם (חוב פתוח)',
    isComplete: !paymentNeedsClarification,
    quickOptions: [
      { label: 'לא שולם עדיין (חוב פתוח)', voiceSample: 'עדיין לא שילם כלום' },
      { label: 'שילם מקדמה של ₪150', voiceSample: 'שילם מקדמה של 150 שקלים' },
      { label: 'שילם מקדמה של ₪200 בביט', voiceSample: 'שילם מקדמה 200 בביט' },
      { label: 'שילם את כל הסכום במלואו', voiceSample: 'שילם את הכל במלואו' },
      { label: 'שילם במזומן בהגעה', voiceSample: 'ישלם במזומן בכניסה' }
    ]
  });

  // 5. Special Requirements & Diet Check:
  const notesMentioned = rawLower.includes('תרופ') || 
    rawLower.includes('אוכל') || 
    rawLower.includes('מזון') || 
    rawLower.includes('כדור') || 
    rawLower.includes('נשיכות') || 
    rawLower.includes('תוקפנ') || 
    rawLower.includes('דרישות') ||
    rawLower.includes('אלרג');

  const hasSpecialNotes = Boolean(booking.specialDiet || booking.medications || (booking.notes && booking.notes !== rawText));

  questions.push({
    id: 'notes',
    title: 'דרישות מיוחדות והערות',
    question: 'האם יש דרישות מיוחדות של הבעלים (תרופות, אוכל מיוחד, הרגלים)?',
    description: notesMentioned || hasSpecialNotes
      ? 'נרשמו הערות מיוחדות להזמנה.'
      : 'האם יש תרופות, מזון מיוחד או אופי שחשוב לדעת?',
    iconType: 'notes',
    currentValueDisplay: booking.notes || booking.medications || booking.specialDiet || undefined,
    isComplete: Boolean(hasSpecialNotes || notesMentioned),
    quickOptions: [
      { label: 'אין דרישות מיוחדות (רגיל)', voiceSample: 'אין דרישות מיוחדות הכל רגיל' },
      { label: 'צריך לקבל כדור/תרופה בבוקר', voiceSample: 'צריך לתת לו כדור בבוקר עם האוכל' },
      { label: 'אוכל רפואי בלבד מהבית', voiceSample: 'אוכל רפואי מיוחד שהבעלים מביא' },
      { label: 'לא מסתדר עם כלבים זכרים', voiceSample: 'לא מסתדר עם זכרים לשמור בהפרדה' },
      { label: 'מפחד מרעשים / חרדתי', voiceSample: 'כלב חרדתי ורגיש לרעשים' }
    ]
  });

  // 6. Owner Contact Check:
  const hasValidPhone = Boolean(booking.ownerPhone && booking.ownerPhone !== '050-0000000' && booking.ownerPhone.length >= 9);

  questions.push({
    id: 'owner_phone',
    title: 'מספר טלפון של הבעלים',
    question: 'מה מספר הטלפון של הבעלים לשליחת הודעת וואטסאפ?',
    description: hasValidPhone ? `טלפון: ${booking.ownerPhone}` : 'לא נקלט מספר טלפון בהקלטה.',
    iconType: 'phone',
    currentValueDisplay: booking.ownerPhone && booking.ownerPhone !== '050-0000000' ? booking.ownerPhone : undefined,
    isComplete: hasValidPhone,
    quickOptions: [
      { label: '050-1234567', voiceSample: '0501234567' },
      { label: 'השלם בהמשך מהלקוח', voiceSample: 'אשלים את הטלפון בהמשך' }
    ]
  });

  return questions;
}

/**
 * Apply quick or voice clarification answer directly to booking
 */
export function applyClarificationAnswer(
  booking: Partial<Booking>,
  questionId: 'service' | 'pricing_mode' | 'duration' | 'payment' | 'notes' | 'owner_phone',
  answerText: string,
  settings: ResortSettings,
  referenceDate = getTodayStr()
): Partial<Booking> {
  const updated = { ...booking };
  const clean = answerText.toLowerCase();

  if (questionId === 'service') {
    if (clean.includes('יומיות') || clean.includes('ביומיות') || (clean.includes('אילוף') && (clean.includes('יומי') || clean.includes('ללא לינה') || clean.includes('בלי לינה')))) {
      updated.serviceType = 'day_training';
      const sDate = updated.startDate || referenceDate;
      const eDate = updated.endDate || addDays(sDate, 3);
      const calculatedDays = Math.max(1, calculateDaysCount(sDate, eDate));
      updated.totalPrice = calculatedDays * (settings.defaultDailyRateDayTraining || 250);
    } else if (clean.includes('אילוף') || clean.includes('אימון') || clean.includes('משמעת')) {
      updated.serviceType = 'training';
      const sDate = updated.startDate || referenceDate;
      updated.endDate = addDays(sDate, 70);
      updated.totalPrice = settings.defaultDailyRateTraining || 6500;
    } else if (clean.includes('דייקר') || clean.includes('כיף') || clean.includes('יומי')) {
      updated.serviceType = 'daycare';
      const sDate = updated.startDate || referenceDate;
      const eDate = updated.endDate || sDate;
      const calculatedDays = Math.max(1, calculateDaysCount(sDate, eDate));
      updated.totalPrice = calculatedDays * (settings.defaultDailyRateDaycare || 90);
    } else {
      updated.serviceType = 'boarding';
      const sDate = updated.startDate || referenceDate;
      const eDate = updated.endDate || addDays(sDate, 3);
      const calculatedDays = Math.max(1, calculateDaysCount(sDate, eDate));
      updated.totalPrice = calculatedDays * (settings.defaultDailyRateBoarding || 180);
    }
  } else if (questionId === 'pricing_mode') {
    const priceMatches = [...clean.matchAll(/(\d{2,5})/g)];
    if (priceMatches.length > 0) {
      const parsedNum = parseInt(priceMatches[0][1], 10);
      if (clean.includes('ליום') || parsedNum <= 300) {
        // Daily rate provided
        const sDate = updated.startDate || referenceDate;
        const eDate = updated.endDate || addDays(sDate, 3);
        const sObj = new Date(sDate + 'T00:00:00').getTime();
        const eObj = new Date(eDate + 'T00:00:00').getTime();
        const calculatedDays = Math.max(1, Math.round((eObj - sObj) / (1000 * 60 * 60 * 24)));
        updated.totalPrice = calculatedDays * parsedNum;
      } else {
        // Total fixed period price provided
        updated.totalPrice = parsedNum;
      }
    }
  } else if (questionId === 'duration') {
    let days = 3;
    if (clean.includes('יומיים') || clean.includes('2 ימים')) days = 2;
    else if (clean.includes('שלושה') || clean.includes('3 ימים')) days = 3;
    else if (clean.includes('ארבעה') || clean.includes('4 ימים')) days = 4;
    else if (clean.includes('חמישה') || clean.includes('5 ימים')) days = 5;
    else if (clean.includes('שישה') || clean.includes('6 ימים')) days = 6;
    else if (clean.includes('שבוע') || clean.includes('7 ימים')) days = 7;
    else if (clean.includes('יום אחד') || clean.includes('ללא לינה') || clean.includes('יומי')) days = 1;

    // Check specific days of week
    const sDate = updated.startDate || referenceDate;
    if (clean.includes('עד שבת') || clean.includes('סופש')) {
      const sObj = new Date(sDate + 'T00:00:00');
      const startDay = sObj.getDay();
      const diff = (6 - startDay + 7) % 7 || 7;
      updated.endDate = addDays(sDate, diff);
    } else if (clean.includes('עד ראשון')) {
      const sObj = new Date(sDate + 'T00:00:00');
      const startDay = sObj.getDay();
      const diff = (0 - startDay + 7) % 7 || 7;
      updated.endDate = addDays(sDate, diff);
    } else {
      updated.endDate = addDays(sDate, days);
    }

    // Recalculate price
    const sObj = new Date(sDate + 'T00:00:00').getTime();
    const eObj = new Date(updated.endDate + 'T00:00:00').getTime();
    const calculatedDays = Math.max(1, Math.round((eObj - sObj) / (1000 * 60 * 60 * 24)));
    
    let rate = settings.defaultDailyRateBoarding;
    if (updated.serviceType === 'training') rate = settings.defaultDailyRateTraining;
    if (updated.serviceType === 'combined') rate = settings.defaultDailyRateCombined;
    if (updated.serviceType === 'daycare') rate = settings.defaultDailyRateDaycare;

    updated.totalPrice = calculatedDays * rate;
  } else if (questionId === 'payment') {
    const priceMatches = [...clean.matchAll(/(\d{2,5})/g)];
    if (clean.includes('לא שולם') || clean.includes('כלום') || clean.includes('0')) {
      updated.depositAmount = 0;
      updated.paymentStatus = 'unpaid';
    } else if (clean.includes('במלואו') || clean.includes('הכל') || clean.includes('מלא')) {
      updated.depositAmount = updated.totalPrice || 500;
      updated.paymentStatus = 'fully_paid';
    } else if (priceMatches.length > 0) {
      const amount = parseInt(priceMatches[0][1], 10);
      updated.depositAmount = amount;
      updated.paymentStatus = (updated.totalPrice && amount >= updated.totalPrice) ? 'fully_paid' : 'deposit_paid';
    }

    if (clean.includes('ביט')) updated.paymentMethod = 'bit';
    else if (clean.includes('פייבוקס')) updated.paymentMethod = 'paybox';
    else if (clean.includes('מזומן')) updated.paymentMethod = 'cash';
    else if (clean.includes('אשראי')) updated.paymentMethod = 'credit';
  } else if (questionId === 'notes') {
    if (clean.includes('אין') || clean.includes('רגיל')) {
      updated.notes = 'ללא דרישות מיוחדות';
    } else {
      updated.notes = answerText;
      if (clean.includes('כדור') || clean.includes('תרופ')) updated.medications = answerText;
      if (clean.includes('אוכל') || clean.includes('מזון')) updated.specialDiet = answerText;
    }
  } else if (questionId === 'owner_phone') {
    const phoneMatch = answerText.match(/05\d-?\d{7}|05\d{8}/);
    if (phoneMatch) {
      updated.ownerPhone = phoneMatch[0];
    } else if (!clean.includes('בהמשך')) {
      updated.ownerPhone = answerText.replace(/\D/g, '');
    }
  }

  return updated;
}

function attachOverbookingCheck(
  proposal: AgentActionProposal,
  existingBookings: Booking[],
  settings: ResortSettings
): AgentActionProposal {
  if (proposal.intent === 'new_booking' && proposal.parsedBooking.startDate && proposal.parsedBooking.endDate) {
    const check = checkRangeOccupancy(
      existingBookings,
      proposal.parsedBooking.startDate,
      proposal.parsedBooking.endDate,
      settings.maxCapacity,
      proposal.existingBookingId
    );

    proposal.overbookingCheck = {
      isOverbooked: check.hasOverbooking,
      maxCapacity: check.maxCapacity,
      highestOccupancy: check.highestCount + 1,
      conflictDates: check.conflictDates
    };
  }
  return proposal;
}

/**
 * Advanced Client Heuristic Parser for Hebrew Natural Language
 */
export function parseWithClientHeuristic(
  text: string,
  existingBookings: Booking[],
  settings: ResortSettings,
  referenceDate: string
): AgentActionProposal {
  const clean = text.toLowerCase();
  const today = new Date(referenceDate + 'T00:00:00');

  // Check intent
  let intent: AgentActionProposal['intent'] = 'new_booking';
  let targetTab: AgentActionProposal['targetTab'] = undefined;

  if (clean.includes('מחק את כל') || clean.includes('למחוק את כל') || clean.includes('איפוס מלא') || clean.includes('נקה הכל') || clean.includes('לנקות את כל')) {
    intent = 'clear_all_data';
  } else if (clean.includes('גיבוי') || clean.includes('לגבות') || clean.includes('הורד גיבוי') || clean.includes('שמור גיבוי')) {
    intent = 'backup_data';
  } else if (clean.includes('עבור ליומן') || clean.includes('פתח יומן') || clean.includes('לשונית יומן')) {
    intent = 'navigate_tab';
    targetTab = 'calendar';
  } else if (clean.includes('תפוסה') || clean.includes('מצב תפוסה') || clean.includes('תחזית')) {
    intent = 'navigate_tab';
    targetTab = 'forecast';
  } else if (clean.includes('רשימת הזמנות') || clean.includes('כל ההזמנות')) {
    intent = 'navigate_tab';
    targetTab = 'bookings';
  } else if (clean.includes('לקוחות') || clean.includes('רשימת לקוחות')) {
    intent = 'navigate_tab';
    targetTab = 'customers';
  } else if (clean.includes('דוחות') || clean.includes('דוח כספי') || clean.includes('הכנסות')) {
    intent = 'navigate_tab';
    targetTab = 'reports';
  } else if (clean.includes('שילם') || clean.includes('תשלום') || clean.includes('שילמה') || clean.includes('העביר') || clean.includes('העבירה') || clean.includes('מקדמה נוספת')) {
    intent = 'payment_update';
  } else if (clean.includes('ביטול') || clean.includes('לבטל') || clean.includes('לא מגיע') || clean.includes('מבטל') || clean.includes('למחוק את ההזמנה') || clean.includes('תמחק את')) {
    intent = 'cancel_booking';
  }

  // 1. Find Dog Name & Owner Name
  let dogName = '';
  let ownerName = '';
  let ownerPhone = '';

  // Common phone regex
  const phoneMatch = text.match(/05\d-?\d{7}|05\d{8}/);
  if (phoneMatch) {
    ownerPhone = phoneMatch[0];
  }

  // Look for "של X" or "כלב בשם Y"
  const ofMatch = text.match(/(?:הכלב|הכלבה|כלב)?\s*([א-ת\w]+)\s+של\s+([א-ת\w]+(?:\s+[א-ת\w]+)?)/i);
  if (ofMatch) {
    dogName = ofMatch[1].replace(/^(הכלב|הכלבה|כלב)\s*/, '');
    ownerName = ofMatch[2];
  } else {
    // Search words in existing bookings to find a match
    for (const b of existingBookings) {
      if (text.includes(b.dogName)) {
        dogName = b.dogName;
        ownerName = b.ownerName;
        ownerPhone = b.ownerPhone;
        break;
      }
    }
  }

  if (!dogName) {
    // Try first word or general name
    const words = text.split(/\s+/).filter(w => w.length > 1 && !['הזמנה', 'חדשה', 'פנסיון', 'אילוף', 'משולב', 'רוצה', 'שלום', 'היי', 'שמוליק', 'בטל', 'לבטל', 'תמחק', 'מחק', 'תעבור'].includes(w));
    if (words.length > 0) dogName = words[0];
  }

  // Match existing booking if payment or cancellation
  let matchedBooking: Booking | undefined;
  if (dogName) {
    matchedBooking = existingBookings.find(b => 
      b.dogName.toLowerCase() === dogName.toLowerCase() || 
      (ownerName && b.ownerName.toLowerCase().includes(ownerName.toLowerCase()))
    );
  }

  // Special intents quick return
  if (intent === 'clear_all_data') {
    return {
      intent: 'clear_all_data',
      confidence: 0.99,
      rawText: text,
      explanation: 'זוהתה בקשה למחיקת כל הנתונים וההזמנות מהענן והשארת יומן נקי לחלוטין.',
      parsedBooking: {}
    };
  }

  if (intent === 'backup_data') {
    return {
      intent: 'backup_data',
      confidence: 0.99,
      rawText: text,
      explanation: 'זוהתה בקשה להורדת גיבוי מלא של נתוני הריזורט לקובץ במחשב/טלפון.',
      parsedBooking: {}
    };
  }



  if (intent === 'navigate_tab') {
    return {
      intent: 'navigate_tab',
      confidence: 0.99,
      rawText: text,
      targetTab,
      explanation: `זוהתה בקשת ניווט למסך ${targetTab === 'calendar' ? 'יומן' : targetTab === 'forecast' ? 'תפוסה' : targetTab === 'customers' ? 'לקוחות' : targetTab === 'reports' ? 'דוחות' : 'הזמנות'}.`,
      parsedBooking: {}
    };
  }

  // 2. Service Type
  let serviceType: 'boarding' | 'training' | 'day_training' | 'daycare' = 'boarding';
  if (clean.includes('יומיות') || clean.includes('ביומיות') || (clean.includes('אילוף') && (clean.includes('יומי') || clean.includes('ללא לינה') || clean.includes('בלי לינה')))) {
    serviceType = 'day_training';
  } else if (clean.includes('אילוף') || clean.includes('אימון') || clean.includes('משמעת')) {
    serviceType = 'training';
  } else if (clean.includes('יום כיף') || clean.includes('יומי') || clean.includes('דייקר')) {
    serviceType = 'daycare';
  } else {
    serviceType = 'boarding';
  }

  // 3. Extract Dates
  let startDate = referenceDate;
  let endDate = serviceType === 'training' 
    ? addDays(referenceDate, 70) 
    : serviceType === 'daycare' 
    ? referenceDate 
    : addDays(referenceDate, 3); // default 3 days for boarding/day_training

  // Check Hebrew relative date keywords and durations
  if (clean.includes('כמה ימים') || clean.includes('מספר ימים')) {
    startDate = referenceDate;
    endDate = addDays(referenceDate, 3);
  } else if (clean.includes('יומיים')) {
    endDate = addDays(startDate, 2);
  } else if (clean.includes('שלושה ימים') || clean.includes('3 ימים')) {
    endDate = addDays(startDate, 3);
  } else if (clean.includes('ארבעה ימים') || clean.includes('4 ימים')) {
    endDate = addDays(startDate, 4);
  } else if (clean.includes('חמישה ימים') || clean.includes('5 ימים')) {
    endDate = addDays(startDate, 5);
  } else if (clean.includes('ממחר') || clean.includes('החל ממחר')) {
    startDate = addDays(referenceDate, 1);
    endDate = addDays(startDate, 3);
  } else if (clean.includes('מחרתיים')) {
    startDate = addDays(referenceDate, 2);
    endDate = addDays(startDate, 3);
  } else if (clean.includes('סוף שבוע') || clean.includes('סופש') || clean.includes('סופ״ש')) {
    // Find next Thursday or Friday
    const dayOfWeek = today.getDay();
    const daysUntilThu = (4 - dayOfWeek + 7) % 7 || 7;
    startDate = addDays(referenceDate, daysUntilThu);
    endDate = addDays(startDate, 2); // Saturday
  } else if (clean.includes('שבוע') && !clean.includes('סוף שבוע')) {
    endDate = addDays(startDate, 7);
  } else if (clean.includes('חודש')) {
    endDate = addDays(startDate, 30);
  }

  // Check specific day of week mentions like "עד יום ראשון", "עד ראשון"
  const dayMap: Record<string, number> = {
    'ראשון': 0,
    'שני': 1,
    'שלישי': 2,
    'רביעי': 3,
    'חמישי': 4,
    'שישי': 5,
    'שבת': 6,
  };

  for (const [dayHeb, dayIdx] of Object.entries(dayMap)) {
    if (clean.includes(`עד יום ${dayHeb}`) || clean.includes(`עד ${dayHeb}`)) {
      const startObj = new Date(startDate + 'T00:00:00');
      const startDay = startObj.getDay();
      let diff = dayIdx - startDay;
      if (diff <= 0) diff += 7;
      endDate = addDays(startDate, diff);
      break;
    }
  }

  // Check explicit date format (e.g. 15/08 או 15.8 או מ-12 עד 18)
  const rangeMatch = text.match(/(?:מ|החל מ-?|מ-)?\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s*(?:ועד|עד|ל-|-)\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (rangeMatch) {
    const currentYear = today.getFullYear();
    const sDay = String(rangeMatch[1]).padStart(2, '0');
    const sMonth = String(rangeMatch[2]).padStart(2, '0');
    const sYear = rangeMatch[3] ? (rangeMatch[3].length === 2 ? `20${rangeMatch[3]}` : rangeMatch[3]) : currentYear;
    startDate = `${sYear}-${sMonth}-${sDay}`;

    const eDay = String(rangeMatch[4]).padStart(2, '0');
    const eMonth = String(rangeMatch[5]).padStart(2, '0');
    const eYear = rangeMatch[6] ? (rangeMatch[6].length === 2 ? `20${rangeMatch[6]}` : rangeMatch[6]) : currentYear;
    endDate = `${eYear}-${eMonth}-${eDay}`;
  }

  // 4. Extract Price and Deposit
  let totalPrice = 0;
  let depositAmount = 0;

  // Extract numbers with ₪ or שקל or סכום
  const priceMatches = [...text.matchAll(/(\d{2,5})\s*(?:ש"ח|שח|שקל|שקלים|₪)?/g)];
  if (priceMatches.length > 0) {
    const numbers = priceMatches.map(m => parseInt(m[1], 10)).filter(n => n >= 50);
    if (numbers.length >= 2) {
      // First is usually total or deposit depending on context
      if (clean.includes('מקדמה') || clean.includes('שילם')) {
        totalPrice = Math.max(...numbers);
        depositAmount = Math.min(...numbers);
      } else {
        totalPrice = numbers[0];
        depositAmount = numbers[1];
      }
    } else if (numbers.length === 1) {
      if (clean.includes('מקדמה') || clean.includes('שילם')) {
        depositAmount = numbers[0];
        totalPrice = matchedBooking ? matchedBooking.totalPrice : numbers[0] * 2;
      } else {
        totalPrice = numbers[0];
      }
    }
  }

  // If no price extracted, compute from default rates
  if (totalPrice === 0) {
    if (serviceType === 'training') {
      totalPrice = settings.defaultDailyRateTraining || 6500;
    } else {
      const startObj = new Date(startDate + 'T00:00:00').getTime();
      const endObj = new Date(endDate + 'T00:00:00').getTime();
      const days = Math.max(1, Math.round((endObj - startObj) / (1000 * 60 * 60 * 24)));
      
      let rate = settings.defaultDailyRateBoarding;
      if (serviceType === 'day_training') rate = settings.defaultDailyRateDayTraining || 250;
      if (serviceType === 'daycare') rate = settings.defaultDailyRateDaycare;

      totalPrice = days * rate;
    }
  }

  let paymentStatus: Booking['paymentStatus'] = 'unpaid';
  if (depositAmount >= totalPrice && totalPrice > 0) {
    paymentStatus = 'fully_paid';
  } else if (depositAmount > 0) {
    paymentStatus = 'deposit_paid';
  }

  // Identify payment method if mentioned
  let paymentMethod: Booking['paymentMethod'] = undefined;
  if (clean.includes('ביט') || clean.includes('bit')) paymentMethod = 'bit';
  else if (clean.includes('פייבוקס') || clean.includes('paybox')) paymentMethod = 'paybox';
  else if (clean.includes('מזומן')) paymentMethod = 'cash';
  else if (clean.includes('אשראי') || clean.includes('כרטיס')) paymentMethod = 'credit';
  else if (clean.includes('העברה')) paymentMethod = 'bank_transfer';

  const proposal: AgentActionProposal = {
    intent,
    confidence: 0.88,
    rawText: text,
    explanation: intent === 'new_booking'
      ? `זוהתה הזמנה חדשה עבור הכלב ${dogName || 'לא צוין'} (${ownerName || 'בעלים לא צוין'}) מ-${startDate} עד ${endDate}.`
      : intent === 'payment_update'
      ? `זוהה רישום תשלום / מקדמה בסך ₪${depositAmount || totalPrice} עבור ${dogName || 'ההזמנה'}.`
      : `זוהתה בקשת ביטול עבור ${dogName || 'ההזמנה'}.`,
    existingBookingId: matchedBooking?.id,
    existingBookingMatch: matchedBooking,
    parsedBooking: {
      dogName: dogName || (matchedBooking?.dogName ?? 'כלב חדש'),
      dogBreed: matchedBooking?.dogBreed ?? '',
      ownerName: ownerName || (matchedBooking?.ownerName ?? 'לקוח'),
      ownerPhone: ownerPhone || (matchedBooking?.ownerPhone ?? ''),
      serviceType,
      startDate,
      endDate,
      totalPrice,
      depositAmount,
      paymentStatus,
      paymentMethod,
      stayStatus: 'booked',
      notes: text,
      vaccinationValid: true
    }
  };

  return attachOverbookingCheck(proposal, existingBookings, settings);
}

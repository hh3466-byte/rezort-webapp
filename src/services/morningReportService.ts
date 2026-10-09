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
  unansweredChats?: UnansweredChatSummary[] | number,
  growPayments: any[] = []
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

  // Count actual dog heads (1 card = 1 dog, since pairs have separate cards)
  const countDogs = (list: Booking[]) => list.length;

  const presentDogsCount = countDogs(presentDaytimeDogs);
  const incomingDogsCount = countDogs(incomingDogs);
  const departingDogsCount = countDogs(departingDogs);
  const endOfDayDogsCount = countDogs(endOfDayDogs);

  const maxCapacity = Number(settings.maxCapacity) || 10;
  const occupancyPercent = maxCapacity > 0 ? Math.round((endOfDayDogsCount / maxCapacity) * 100) : 0;
  const growPaymentLink = settings.growPaymentLink || settings.payboxPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

  const isTrainingBooking = (b: Booking) => {
    const s = b.serviceType;
    return s === 'training' || s === 'day_training' || s === 'combined';
  };

  const endOfDayBoarding = endOfDayDogs.filter(b => !isTrainingBooking(b));
  const endOfDayTraining = endOfDayDogs.filter(b => isTrainingBooking(b));
  const endOfDayBoardingCount = countDogs(endOfDayBoarding);
  const endOfDayTrainingCount = countDogs(endOfDayTraining);

  const boardingOvernightLine = `   • פנסיון: ${endOfDayBoardingCount} כלבים${endOfDayBoarding.length > 0 ? ` (${endOfDayBoarding.map(b => b.dogName).join(', ')})` : ''}`;
  const trainingOvernightLine = `   • אילוף: ${endOfDayTrainingCount} כלבים${endOfDayTraining.length > 0 ? ` (${endOfDayTraining.map(b => b.dogName).join(', ')})` : ''}`;

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
        const bId = b.id || '';
        const shortUrl = bId
          ? `https://rezort-webapp.vercel.app/api/wa-reminder?b=${bId}&t=${isIncoming ? 'in' : 'out'}`
          : `https://wa.me/${intlPhone}`;
        linkLine = `\n   📲 לינק לשליחת ההודעה ללקוח: ${shortUrl}`;
      }
    } else if (totalPrice > 0 && deposit === 0) {
      paymentBadge = `🔴 לא שולם (חוב: ₪${totalPrice.toLocaleString()})`;
      const cleanPhone = cleanPhoneNumber(rawPhone);
      if (cleanPhone) {
        const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
        const bId = b.id || '';
        const shortUrl = bId
          ? `https://rezort-webapp.vercel.app/api/wa-reminder?b=${bId}&t=${isIncoming ? 'in' : 'out'}`
          : `https://wa.me/${intlPhone}`;
        linkLine = `\n   📲 לינק לשליחת ההודעה ללקוח: ${shortUrl}`;
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
    const aiStart = ai.startDate || '';
    const aiEnd = ai.endDate || '';
    // Auto-archive rule: if dates have already passed without a booking, ignore from report
    if ((aiEnd && aiEnd < todayStr) || (aiStart && aiStart < todayStr)) return false;

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

  const unhandledIntakes = safeIntakes.filter(r => {
    const s = r.status as string;
    if (s === 'approved' || s === 'rejected' || s === 'archived' || s === 'abandoned') return false;
    const rStart = r.startDate || '';
    const rEnd = r.endDate || '';
    // Auto-archive rule: if dates have already passed without a booking, ignore from report
    if ((rEnd && rEnd < todayStr) || (rStart && rStart < todayStr)) return false;

    const rDog = (r.dogName || '').trim().toLowerCase();
    const rPhone = cleanPhoneNumber(r.ownerPhone || '');
    const hasBooking = activeBookings.some(b => {
      const bDog = (b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.ownerPhone || '');
      return (rDog && bDog && rDog === bDog && (bPhone.slice(-7) === rPhone.slice(-7) || !rPhone));
    });
    return !hasBooking;
  });

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

  safeIntakes.filter(r => (r.status as string) === 'pending' || (r.status as string) === 'approved').forEach(r => {
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

  // 1. Unhandled Intakes (Pending, In Progress, Payment Requested) - FIRST PRIORITY
  if (unhandledIntakes.length > 0) {
    const list = unhandledIntakes.map((pi, idx) => {
      const dog = pi.dogName || 'כלב';
      const owner = pi.ownerName || 'בעלים';
      const rawPhone = pi.ownerPhone || '';
      const phone = formatPhoneFormatted(rawPhone);
      const dates = `${formatDateIL(pi.startDate)} עד ${formatDateIL(pi.endDate)}`;
      const notes = (pi.internalNotes || '').trim();
      let statusBadge = '🔴 לבדיקה';
      if ((pi.status as string) === 'payment_requested') statusBadge = '💳 נשלח קישור לתשלום';
      else if ((pi.status as string) === 'in_progress' || notes.length > 0) statusBadge = '🟡 בתהליך';
      return `${idx + 1}. ${statusBadge}: *${dog}* (${owner} - 📞 ${phone}) | מיועד: ${dates}`;
    }).join('\n');
    actionBlocks.push(`📋 *שאלוני קליטה לבדיקה / בתהליך שממתינים לטיפול וסגירה (${unhandledIntakes.length}):*\n${list}\n👉 *שמוליק, אנא היכנס למסך שאלוני קליטה כדי לאשר, לקלוט ליומן או לסגור טיפול.*`);
  }

  // 2. Unanswered WhatsApp messages
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

  // 3. Approved intakes without calendar booking
  if (approvedIntakesWithoutBooking.length > 0) {
    const list = approvedIntakesWithoutBooking.map((ai, idx) => {
      const dog = ai.dogName || 'כלב';
      const owner = ai.ownerName || 'בעלים';
      const rawPhone = ai.ownerPhone || '';
      const phone = formatPhoneFormatted(rawPhone);
      const dates = `${formatDateIL(ai.startDate)} עד ${formatDateIL(ai.endDate)}`;
      return `${idx + 1}. ⚠️ *${dog}* (${owner} - 📞 ${phone}) | ${dates}`;
    }).join('\n');
    actionBlocks.push(`⚠️ *שאלונים שאושרו אך טרם שוריינו ביומן (${approvedIntakesWithoutBooking.length}):*\n${list}`);
  }

  // 4. Unassigned kennel placement
  const unassignedKennelDogs = activeBookings.filter(b => {
    const isStayingOrIncoming = (b.startDate <= tomorrowStr && b.endDate >= tomorrowStr) || b.startDate === tomorrowStr;
    return isStayingOrIncoming && !b.kennelNumber && b.kennelNumber !== 0;
  });
  if (unassignedKennelDogs.length > 0) {
    const list = unassignedKennelDogs.map((b, idx) => {
      const phone = formatPhoneFormatted(b.ownerPhone || '');
      return `${idx + 1}. 📋 *${b.dogName}* (${b.ownerName} - 📞 ${phone}) | שהייה: ${formatDateIL(b.startDate)}–${formatDateIL(b.endDate)} (ממתין לשיבוץ חדר 1–7, סוויטה 1–4, שביל או הלנה ביתית ודלי מזון)`;
    }).join('\n');
    actionBlocks.push(`🏠 *כלבים הממתינים לשיבוץ מיקום לינה ודלי מזון (${unassignedKennelDogs.length}):*\n${list}`);
  }

  if (phoneAndDateIssues.length > 0) {
    const list = phoneAndDateIssues.map(issue => `• ${issue}`).join('\n');
    actionBlocks.push(`📞 *תקלות טלפונים ותאריכים:*\n${list}`);
  }

  // 5. Zero Deposit bookings holding spots
  const zeroDepositUpcoming = activeBookings.filter(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const isFree = b.isFreeStay;
    return price > 0 && deposit === 0 && !isFree && b.endDate >= todayStr && b.stayStatus !== 'checked_out';
  });
  if (zeroDepositUpcoming.length > 0) {
    const list = zeroDepositUpcoming.map((b, idx) => {
      const phone = formatPhoneFormatted(b.ownerPhone || '');
      return `${idx + 1}. 🔴 *${b.dogName}* (${b.ownerName} - 📞 ${phone}) | ${formatDateIL(b.startDate)}–${formatDateIL(b.endDate)} | ₪0 מקדמה (חוב: ₪${Number(b.totalPrice).toLocaleString()})`;
    }).join('\n');
    actionBlocks.push(`🔴 *שריונים ללא מקדמה (₪0) שתופסים מקום ביומן (${zeroDepositUpcoming.length}):*\n${list}`);
  }

  // 6. Pricing, Debts & Grow Clearing Discrepancies (Active & Future stays only)
  const financialDiscrepancies: string[] = [];
  const activeAndFutureForFin = activeBookings.filter(b => b.endDate >= todayStr && b.stayStatus !== 'checked_out');

  activeAndFutureForFin.forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const notes = b.notes || '';
    const isPairZeroCharge = b.isFreeStay && (notes.includes('זוג') || notes.includes('שולם דרך') || notes.includes('כלב נוסף') || notes.includes('כלב שני'));
    const isFree = b.isFreeStay || isPairZeroCharge;
    const dailyRate = Number(b.dailyRate) || 0;
    const dog = (b.dogName || '').trim();
    const owner = (b.ownerName || '').trim();
    const phone = formatPhoneFormatted(b.ownerPhone || '');
    const paymentStatus = b.paymentStatus || 'unpaid';

    if (isFree || isPairZeroCharge) return;

    let days = 1;
    if (b.startDate && b.endDate) {
      const startMs = new Date(b.startDate).getTime();
      const endMs = new Date(b.endDate).getTime();
      days = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
    }

    // 1. Negative balance / Deposit > Total Price on future/active stays
    if (deposit > price && !isFree && price > 0 && (deposit - price) > 50) {
      financialDiscrepancies.push(`🚨 חריגת תשלום (יתרה שלילית): *${dog}* (${owner} - 📞 ${phone}) | נקלט תשלום ₪${deposit.toLocaleString()} מתוך סה"כ ₪${price.toLocaleString()}!`);
    }

    // 2. Multi-dog booking without period pricing
    const isMultiDog = dog.includes(' ו') || dog.includes(' + ') || dog.includes(' and ');
    if (isMultiDog && b.pricingMode !== 'period' && b.serviceType !== 'training' && !isFree) {
      financialDiscrepancies.push(`🐶🐶 תמחור זוג כלבים: *${dog}* (${owner}) | נדרש לוודא שהתמחור מוגדר כ'מחיר פיקס/לתקופה' הכולל את שני הכלבים.`);
    }

    // 3. Status inconsistency (marked fully_paid but deposit < price)
    if (!isFree && price > 0) {
      if (deposit > 0 && deposit < price && paymentStatus === 'fully_paid') {
        financialDiscrepancies.push(`💰 אי-התאמת סטטוס: *${dog}* (${owner}) מסומן כשולם מלא אך קיימת יתרת חוב של ₪${(price - deposit).toLocaleString()} (שולם ₪${deposit.toLocaleString()} מתוך ₪${price.toLocaleString()})`);
      }
    }

    // 4. Stay extension mentioned in notes with open debt
    const isExtension = notes.includes('הוארך') || notes.includes('הארכה') || notes.includes('עודכן מוואטסאפ');
    if (isExtension && price > deposit && !isFree) {
      financialDiscrepancies.push(`💰 שהות מוארכת עם יתרת חוב פתוחה: *${dog}* (${owner} - 📞 ${phone}) | שהות הוארכה עד ${formatDateIL(b.endDate)}, נותרה יתרה לגבייה: ₪${(price - deposit).toLocaleString()} (שולם ₪${deposit.toLocaleString()} מתוך ₪${price.toLocaleString()})`);
    }

    // 5. Active staying dog with open debt
    const isCurrentlyStaying = b.startDate <= todayStr && b.endDate >= todayStr && b.stayStatus !== 'checked_out';
    if (isCurrentlyStaying && price > deposit && !isFree) {
      financialDiscrepancies.push(`💰 כלב שוהה כעת בריזורט עם יתרת חוב: *${dog}* (${owner} - 📞 ${phone}) | שוהה עד ${formatDateIL(b.endDate)}, נותרה יתרה לתשלום: ₪${(price - deposit).toLocaleString()} (שולם ₪${deposit.toLocaleString()} מתוך ₪${price.toLocaleString()})`);
    }

    // 6. Live Grow clearing reconciliation (only for unverified open balances)
    const isFullyPaidAndClosed = paymentStatus === 'fully_paid' && deposit >= price && deposit > 0;
    const isVerifiedInNotes = notes.includes('שולם במלואו') || notes.includes('אסמכתא');
    if (!isFullyPaidAndClosed && !isVerifiedInNotes) {
      const bCleanPhone = cleanPhoneNumber(b.ownerPhone || '');
      const bName = (b.ownerName || '').trim().toLowerCase();
      const emergencyContact = (b.emergencyContact || '');
      const emergencyPhone = cleanPhoneNumber(emergencyContact);
      const matchedGrow = (growPayments || []).filter(p => {
        const pPhone = cleanPhoneNumber(p.customer_phone || p.customerPhone || '');
        const pName = (p.customer_name || p.customerName || '').trim().toLowerCase();
        const pRef = String(p.reference_id || p.referenceId || p.id || '');
        const phoneMatch = (bCleanPhone && pPhone && bCleanPhone.slice(-7) === pPhone.slice(-7)) ||
                           (emergencyPhone && pPhone && emergencyPhone.slice(-7) === pPhone.slice(-7));
        const nameMatch = bName && pName && (bName.includes(pName) || pName.includes(bName));
        const refMatch = pRef && notes.includes(pRef);
        return phoneMatch || nameMatch || refMatch;
      });
      const totalGrow = matchedGrow.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const pMethod = (b.paymentMethod || '') as string;
      const isGrowMethod = pMethod === 'bit' || pMethod === 'grow' || pMethod === 'credit_card' || pMethod === 'grow_invoice' || pMethod === 'credit' || notes.includes('Grow') || notes.includes('Bit') || notes.includes('אסמכתא');

      if (isGrowMethod && totalGrow > 0 && deposit > totalGrow + 10) {
        financialDiscrepancies.push(`🚨 פער סליקת Grow: *${dog}* (${owner} - 📞 ${phone}) | ביומן רשום ששולם ₪${deposit.toLocaleString()}, אך ב-Grow נסלקו בפועל ₪${totalGrow.toLocaleString()} בלבד! (חסרים ₪${(deposit - totalGrow).toLocaleString()})`);
      }
    }
  });

  if (financialDiscrepancies.length > 0) {
    actionBlocks.push(`💰 *אי-התאמות כספיות / תמחור שדורש בדיקה:*\n• ${financialDiscrepancies.join('\n• ')}`);
  }

  let extraActionSections = '';
  if (actionBlocks.length > 0) {
    extraActionSections = '\n\n🚨 *אורות אדומים:*\n' + actionBlocks.join('\n\n');
  } else {
    extraActionSections = '\n\n🚨 *אורות אדומים:* אין אורות אדומים ✅';
  }

  // Check active staying dogs tonight for regards status
  const stayingTonightCount = activeBookings.filter(b => b.startDate <= todayStr && b.endDate > todayStr).length;
  const regardsStatusLine = stayingTonightCount > 0
    ? `\n🐾 *עדכוני ד"ש ללקוחות:*\nמתוזמנים לשעה 20:00 עבור ${stayingTonightCount} כלבים השוהים הלילה בריזורט (אישור יישלח למנהל מיד בסיום המשלוח).\n`
    : '';

  return `📋 *מה קורה מחר? סקירה יומית לשמוליק – הריזורט לכלב* 🐾
📅 יום ${dayName}, ${formattedDate}

🐾 *נוכחות כללית במתחם מחר:* ${presentDogsCount} כלבים${presentDogsCount !== presentDaytimeDogs.length ? ` (${presentDaytimeDogs.length} הזמנות, כולל זוגות)` : ''}
${regardsStatusLine}
🟢 *כניסות מחר (${incomingDogsCount} כלבים):*
${incomingSection}

🔴 *שחרורים מחר (${departingDogsCount} כלבים):*
${departingSection}

━━━━━━━━━━━━━━━━━━━━━━━━
🐕 *בסוף היום: ${endOfDayDogsCount} כלבים ללינה*
${boardingOvernightLine}
${trainingOvernightLine}
━━━━━━━━━━━━━━━━━━━━━━━━

📊 *תפוסת לינה:* ${endOfDayDogsCount}/${maxCapacity} מקומות (${occupancyPercent}%)${highlightsSection}${extraActionSections}

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

  let effectiveBookings = bookings;
  if (!effectiveBookings || effectiveBookings.length === 0) {
    try {
      const { data: remoteBookings } = await supabase.from('bookings').select('*');
      if (remoteBookings && remoteBookings.length > 0) {
        effectiveBookings = remoteBookings.map((row: any) => {
          const rowData = (row.data && typeof row.data === 'object') ? row.data : {};
          return {
            ...rowData,
            id: row.id || rowData.id,
            dogName: row.dog_name || rowData.dogName || '',
            dogBreed: row.dog_breed || rowData.dogBreed || '',
            dogGender: row.dog_gender || rowData.dogGender || undefined,
            ownerName: row.owner_name || rowData.ownerName || '',
            ownerPhone: row.owner_phone || rowData.ownerPhone || '',
            ownerEmail: row.owner_email || rowData.ownerEmail || '',
            serviceType: row.service_type || rowData.serviceType || 'boarding',
            startDate: row.start_date || rowData.startDate || '',
            endDate: row.end_date || rowData.endDate || '',
            totalPrice: Number(row.total_price ?? rowData.totalPrice ?? 0),
            depositAmount: Number(row.deposit_amount ?? rowData.depositAmount ?? 0),
            paymentStatus: row.payment_status || rowData.paymentStatus || 'unpaid',
            stayStatus: row.stay_status || rowData.stayStatus || 'booked',
            kennelNumber: row.kennel_number !== undefined ? row.kennel_number : rowData.kennelNumber,
            notes: row.notes || rowData.notes || '',
            vaccinationValid: Boolean(row.vaccination_valid ?? rowData.vaccinationValid ?? true),
            createdAt: row.created_at || rowData.createdAt || new Date().toISOString(),
            updatedAt: row.updated_at || rowData.updatedAt || new Date().toISOString(),
          };
        });
      }
    } catch (e) {
      console.warn('Could not fetch fallback bookings from Supabase:', e);
    }
  }

  // Fetch unanswered WhatsApp chats
  let unansweredChats: UnansweredChatSummary[] = [];
  try {
    unansweredChats = await fetchUnansweredChatsSummary(settings, effectiveBookings);
  } catch {}

  // Fetch live Grow incoming payments from Supabase
  let growPayments: any[] = [];
  try {
    const { data: gRows } = await supabase.from('grow_incoming_payments').select('*');
    if (gRows && Array.isArray(gRows)) {
      growPayments = gRows;
    }
  } catch (eGrow) {
    console.warn('Could not fetch grow payments for evening report:', eGrow);
  }

  const managerPhone = cleanPhoneNumber(settings?.whatsappNotificationPhone || '0506336896');
  const adminCopyPhone = '0543200007';
  const reportText = formatTomorrowOverviewReport(
    settings?.managerName || 'שמוליק',
    effectiveBookings,
    settings,
    intakeRequests,
    today,
    unansweredChats,
    growPayments
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
    const adminKey = `admin_1830_sanity_${today}`;
    const shmulikKey = `shmulik_1830_sanity_${today}`;
    if (typeof window !== 'undefined' && window.localStorage && (localStorage.getItem(adminKey) || localStorage.getItem(shmulikKey))) return;

    const curSettings = getSettings();
    const rawData = (curSettings as any)?.data || curSettings || {};
    if (rawData.last1830SanitySentDate === today) return;

    const eligibility = is1830SanityEligibleNow();
    if (!eligibility.eligible) return;

    isSanity1830Sending = true;
    try {
      const res = await send1830SanityReportToShmulik(
        getBookings(),
        curSettings,
        getIntakeRequests()
      );

      if (res.success) {
        showToast?.('🛡️ דוח בדיקת שפיות יומית (18:30) נשלח בהצלחה לוואטסאפ של המנהל! 🐾');
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('🛡️ בדיקת שפיות יומית – הריזורט לכלב', {
              body: 'השעה 18:30! דוח בדיקת שפיות, אירועים ירוקים ואורות אדומים נשלח למנהל בוואטסאפ.',
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

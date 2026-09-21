import { Booking, ResortSettings, IntakeRequest } from '../types';
import { getTodayStr, getDayNameHebrew, formatDateIL, addDays } from '../utils/dateUtils';
import { cleanPhoneNumber, getFirstName, isValidIsraeliPhone } from '../utils/whatsappUtils';
import { sendGreenApiDirectMessage } from './notificationService';
import { isYomKippurDate } from '../utils/jewishCalendar';
import { fetchNewCrmChatsCount } from './whatsappCrmService';
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

  // Ensure safe intake requests fallback from settings.data
  const safeIntakes: IntakeRequest[] = (intakeRequests && intakeRequests.length > 0)
    ? intakeRequests
    : (Array.isArray((settings as any)?.data?.intakeRequests) ? (settings as any).data.intakeRequests : []);

  const pendingIntakes = safeIntakes.filter(r => r.status === 'pending');
  if (pendingIntakes.length > 0) {
    highlights.push(`📥 *שאלונים חדשים לבדיקה:* ${pendingIntakes.length} שאלונים ממתינים`);
  }

  let highlightsSection = '';
  if (highlights.length > 0) {
    highlightsSection = `\n\n⭐ *דגשים ודברים חשובים נוספים:*\n${highlights.map(h => `• ${h}`).join('\n')}`;
  }

  // Comprehensive Sanity & Anomalies Audit (18:30 Check integrated into 19:00 Report)
  const activeUpcoming = bookings.filter(b => 
    b.stayStatus !== 'cancelled' &&
    b.stayStatus !== 'checked_out' &&
    b.endDate >= todayStr
  );

  const sanityAnomalies = {
    unpaidUpcoming: [] as Array<{ dog: string; owner: string; phone: string; dates: string; price: number }>,
    approvedWithoutBooking: [] as Array<{ dog: string; owner: string; phone: string; dates: string }>,
    phoneAnomalies: [] as string[],
    unhandledIntakes: [] as Array<{ dog: string; owner: string; phone: string; dates: string }>,
    typos: [] as string[],
    pricingIssues: [] as string[],
    duplicateAlerts: [] as string[],
    capacityAlerts: [] as string[],
    paymentConfigIssues: [] as string[]
  };

  // 1. Unpaid reservations holding capacity (0 deposit)
  activeUpcoming.forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    const isFree = b.isFreeStay;
    if (price > 0 && deposit === 0 && !isFree) {
      sanityAnomalies.unpaidUpcoming.push({
        dog: b.dogName,
        owner: b.ownerName,
        phone: b.ownerPhone || '',
        dates: `${formatDateIL(b.startDate)} עד ${formatDateIL(b.endDate)}`,
        price
      });
    }
  });

  // 2. Approved intake requests that have NO booking in the calendar (holding status in vacuum)
  const approvedIntakes = safeIntakes.filter(r => r.status === 'approved');
  approvedIntakes.forEach(ai => {
    const aiDog = (ai.dogName || '').trim().toLowerCase();
    const aiPhone = (ai.ownerPhone || '').replace(/\D/g, '');
    const hasMatchingBooking = bookings.some(b => {
      const bDog = (b.dogName || '').trim().toLowerCase();
      const bPhone = (b.ownerPhone || '').replace(/\D/g, '');
      return (aiDog && bDog && aiDog === bDog) || (aiPhone && bPhone && aiPhone === bPhone);
    });
    if (!hasMatchingBooking) {
      sanityAnomalies.approvedWithoutBooking.push({
        dog: ai.dogName,
        owner: ai.ownerName,
        phone: ai.ownerPhone || '',
        dates: `${formatDateIL(ai.startDate)} עד ${formatDateIL(ai.endDate)}`
      });
    }
  });

  // 3. Phone number validity & formatting checks across bookings & intakes
  activeUpcoming.forEach(b => {
    if (b.ownerPhone && !isValidIsraeliPhone(b.ownerPhone)) {
      sanityAnomalies.phoneAnomalies.push(`🐶 הזמנה ל-${b.dogName} (${b.ownerName}): טלפון לא תקין "${b.ownerPhone}" (חובה 10 ספרות נייד)`);
    }
  });
  safeIntakes.filter(r => r.status === 'pending' || r.status === 'approved').forEach(r => {
    if (r.ownerPhone && !isValidIsraeliPhone(r.ownerPhone)) {
      sanityAnomalies.phoneAnomalies.push(`📥 שאלון ${r.dogName} (${r.ownerName}): טלפון לא תקין "${r.ownerPhone}"`);
    }
  });

  // 4. Typos & date contradictions in bookings AND intake forms
  activeUpcoming.forEach(b => {
    const sType = b.serviceType || '';
    if (!b.startDate || !b.endDate) {
      sanityAnomalies.typos.push(`🐶 ${b.dogName} (${b.ownerName}): חסר תאריך כניסה/יציאה חוקי`);
    } else if (b.endDate < b.startDate) {
      sanityAnomalies.typos.push(`🐶 ${b.dogName} (${b.ownerName}): תאריך יציאה (${formatDateIL(b.endDate)}) קודם לכניסה (${formatDateIL(b.startDate)})`);
    } else if ((sType === 'training' || (sType as any) === 'day_training') && b.startDate === b.endDate) {
      sanityAnomalies.typos.push(`🐶 ${b.dogName} (${b.ownerName}): תהליך אילוף הוגדר ליום בודד (${formatDateIL(b.startDate)})`);
    }
  });
  safeIntakes.filter(r => r.status === 'pending' || r.status === 'approved').forEach(r => {
    if (!r.startDate || !r.endDate) {
      sanityAnomalies.typos.push(`📥 שאלון ${r.dogName} (${r.ownerName}): חסר תאריך כניסה/יציאה`);
    } else if (r.endDate < r.startDate) {
      sanityAnomalies.typos.push(`📥 שאלון ${r.dogName} (${r.ownerName}): תאריך יציאה (${formatDateIL(r.endDate)}) קודם לכניסה (${formatDateIL(r.startDate)})`);
    } else if (r.serviceType === 'training' && r.startDate === r.endDate) {
      sanityAnomalies.typos.push(`📥 שאלון ${r.dogName} (${r.ownerName}): תהליך אילוף הוגדר ליום בודד (${formatDateIL(r.startDate)})`);
    }
  });

  // 5. Unhandled pending intake requests
  const pendingIntakesList = safeIntakes.filter(r => r.status === 'pending');
  pendingIntakesList.forEach(r => {
    sanityAnomalies.unhandledIntakes.push({
      dog: r.dogName,
      owner: r.ownerName,
      phone: r.ownerPhone || '',
      dates: `${formatDateIL(r.startDate)} עד ${formatDateIL(r.endDate)}`
    });
  });

  // 6. Payment Link Configuration Sanity (100% link based)
  const effectiveGrowLink = settings.growPaymentLink || (settings as any).payboxPaymentLink;
  if (!effectiveGrowLink || !effectiveGrowLink.includes('http')) {
    sanityAnomalies.paymentConfigIssues.push('חסר קישור תשלום פעיל בהגדרות (Grow Link)! לקוחות לא יכולים לשלם.');
  }

  // 7. Pricing anomalies
  activeUpcoming.forEach(b => {
    const price = Number(b.totalPrice) || 0;
    const deposit = Number(b.depositAmount) || 0;
    if (price <= 0 && !b.isFreeStay) {
      sanityAnomalies.pricingIssues.push(`🐶 ${b.dogName} (${b.ownerName}): סך הכל לתשלום ₪0 (לא סומן אירוח חינם)`);
    }
    if (deposit > price && price > 0) {
      sanityAnomalies.pricingIssues.push(`🐶 ${b.dogName} (${b.ownerName}): מקדמה (₪${deposit}) גדולה מסך ההזמנה (₪${price})`);
    }
  });

  // 8. Advanced Duplicate Detection (Same owner OR Cross-Owner/Partner Ghost Bookings like Boss)
  for (let i = 0; i < activeUpcoming.length; i++) {
    for (let j = i + 1; j < activeUpcoming.length; j++) {
      const b1 = activeUpcoming[i];
      const b2 = activeUpcoming[j];
      const dog1 = (b1.dogName || '').trim().toLowerCase();
      const dog2 = (b2.dogName || '').trim().toLowerCase();
      if (!dog1 || !dog2 || dog1 !== dog2) continue;

      const hasOverlap = (b1.startDate <= b2.endDate && b1.endDate >= b2.startDate);
      if (!hasOverlap) continue;

      const phone1 = (b1.ownerPhone || '').replace(/\D/g, '');
      const phone2 = (b2.ownerPhone || '').replace(/\D/g, '');

      if (phone1 && phone1 === phone2) {
        sanityAnomalies.duplicateAlerts.push(`👥 כפילות זהה ביומן: הכלב "${b1.dogName}" (${b1.ownerName}) מופיע פעמיים בתאריכים חופפים (${formatDateIL(b1.startDate)}-${formatDateIL(b1.endDate)})`);
        continue;
      }

      const dep1 = Number(b1.depositAmount) || 0;
      const dep2 = Number(b2.depositAmount) || 0;
      const isSingleDay1 = b1.startDate === b1.endDate;
      const isSingleDay2 = b2.startDate === b2.endDate;
      const isSuspiciousGhost = (dep1 === 0 && isSingleDay1) || (dep2 === 0 && isSingleDay2) || (b1.startDate === b2.startDate);

      if (isSuspiciousGhost) {
        sanityAnomalies.duplicateAlerts.push(`🚨 *חשד לכפילות שותפים/רשומת רפאים:* הכלב "${b1.dogName}" רשום באותו תאריך תחת 2 בעלים שונים!\n      - רשומה 1: ${b1.ownerName} (📞 ${b1.ownerPhone}) | ${formatDateIL(b1.startDate)}-${formatDateIL(b1.endDate)} | מקדמה: ₪${dep1}\n      - רשומה 2: ${b2.ownerName} (📞 ${b2.ownerPhone}) | ${formatDateIL(b2.startDate)}-${formatDateIL(b2.endDate)} | מקדמה: ₪${dep2}`);
      } else {
        sanityAnomalies.duplicateAlerts.push(`💡 שימו לב: 2 כלבים שונים בשם "${b1.dogName}" שוהים במקביל (${b1.ownerName} מול ${b2.ownerName})`);
      }
    }
  }

  // 9. Overbooking capacity in next 7 days
  for (let d = 0; d < 7; d++) {
    const curDate = new Date(todayStr + 'T00:00:00');
    curDate.setDate(curDate.getDate() + d);
    const y = curDate.getFullYear();
    const m = String(curDate.getMonth() + 1).padStart(2, '0');
    const day = String(curDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    const overnights = activeUpcoming.filter(b => b.startDate <= dateStr && b.endDate > dateStr);
    if (overnights.length > maxCapacity) {
      sanityAnomalies.capacityAlerts.push(`📅 ${formatDateIL(dateStr)}: ${overnights.length} כלבים ללינה (חריגה מ-${maxCapacity})`);
    }
  }

  let sanityAuditSection = '';
  const hasSanityIssues = 
    sanityAnomalies.unpaidUpcoming.length > 0 ||
    sanityAnomalies.approvedWithoutBooking.length > 0 ||
    sanityAnomalies.phoneAnomalies.length > 0 ||
    sanityAnomalies.unhandledIntakes.length > 0 ||
    sanityAnomalies.duplicateAlerts.length > 0 ||
    sanityAnomalies.typos.length > 0 ||
    sanityAnomalies.pricingIssues.length > 0 ||
    sanityAnomalies.capacityAlerts.length > 0 ||
    sanityAnomalies.paymentConfigIssues.length > 0;

  if (!hasSanityIssues) {
    sanityAuditSection = `\n\n🛡️ *בדיקת שפיות וחריגות יומן (18:30):* ✅ כל הנתונים תקינים! אין כפילויות, אין שריונים ללא מקדמה, וכל הטלפונים והתאריכים מאומתים.`;
  } else {
    const sParts = [`\n\n🛡️ *ממצאי בדיקת שפיות, תקלות תקשורת וחריגות ביומן (הופק ב-18:30):*`];
    
    if (sanityAnomalies.unpaidUpcoming.length > 0) {
      sParts.push(`🚨 *שיריוני מקום ביומן ללא מקדמה (${sanityAnomalies.unpaidUpcoming.length} כלבים שומרים מקום בלי לשלם!):*`);
      sanityAnomalies.unpaidUpcoming.forEach(u => {
        sParts.push(`   • 🔴 *${u.dog}* (${u.owner} - ${u.phone}) | ${u.dates} | ₪0 מקדמה (חוב: ₪${u.price.toLocaleString()})`);
      });
    }

    if (sanityAnomalies.approvedWithoutBooking.length > 0) {
      sParts.push(`⚠️ *שאלוני קליטה שסומנו מאושרים אך ללא שריון ביומן (${sanityAnomalies.approvedWithoutBooking.length} שאלונים תלויים):*`);
      sanityAnomalies.approvedWithoutBooking.forEach(a => {
        sParts.push(`   • 🟠 *${a.dog}* (${a.owner} - ${a.phone}) | ${a.dates} | הבקשה סומנה מאושרת אך אין הזמנה ביומן ולא נגבתה מקדמה!`);
      });
    }

    if (sanityAnomalies.unhandledIntakes.length > 0) {
      sParts.push(`📥 *שאלוני קליטה חדשים הממתינים לטיפול ולשליחת לינק (${sanityAnomalies.unhandledIntakes.length}):*`);
      sanityAnomalies.unhandledIntakes.forEach(i => {
        sParts.push(`   • ⏳ *${i.dog}* (${i.owner} - ${i.phone}) | ${i.dates}`);
      });
    }

    if (sanityAnomalies.phoneAnomalies.length > 0) {
      sParts.push(`📞 *תקלות מספרי טלפון (קצר/חסר/שגוי - לא ניתן לשלוח הודעות):*`);
      sanityAnomalies.phoneAnomalies.forEach(p => sParts.push(`   • ${p}`));
    }

    if (sanityAnomalies.duplicateAlerts.length > 0) {
      sParts.push(`👥 *כפילויות ביומן / חשד לשותפים:*`);
      sanityAnomalies.duplicateAlerts.forEach(d => sParts.push(`   • ${d}`));
    }

    if (sanityAnomalies.typos.length > 0) {
      sParts.push(`⚠️ *חשד לטעויות תאריכים:*`);
      sanityAnomalies.typos.forEach(t => sParts.push(`   • ${t}`));
    }

    if (sanityAnomalies.pricingIssues.length > 0) {
      sParts.push(`💰 *אי-התאמות במחירים:*`);
      sanityAnomalies.pricingIssues.forEach(p => sParts.push(`   • ${p}`));
    }

    if (sanityAnomalies.capacityAlerts.length > 0) {
      sParts.push(`📈 *ימים בעומס תפוסה (מעל ${maxCapacity} מקומות):*`);
      sanityAnomalies.capacityAlerts.forEach(c => sParts.push(`   • ${c}`));
    }

    if (sanityAnomalies.paymentConfigIssues.length > 0) {
      sParts.push(`🔗 *הגדרות קישורי תשלום:*`);
      sanityAnomalies.paymentConfigIssues.forEach(c => sParts.push(`   • ${c}`));
    }

    sanityAuditSection = sParts.join('\n');
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
${occupancyStatus}${highlightsSection}${sanityAuditSection}

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

  // Count unread CRM leads
  let newCrmLeadsCount = 0;
  try {
    newCrmLeadsCount = await fetchNewCrmChatsCount(settings, bookings, intakeRequests);
  } catch {}

  const managerPhone = cleanPhoneNumber(settings?.whatsappNotificationPhone || '0506336896');
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

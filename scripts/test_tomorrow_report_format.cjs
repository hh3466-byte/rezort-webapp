const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function getDayNameHebrew(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return HEBREW_DAYS[d.getDay()] || '';
}

function formatDateIL(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const day = parts[2].substring(0, 2);
    const month = parts[1];
    const year = parts[0];
    const yearShort = year.length === 4 ? year.slice(2) : year;
    return `${day}.${month}.${yearShort}`;
  }
  return dateStr;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  return cleaned;
}

function getFirstName(fullName) {
  if (!fullName) return 'לקוח';
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function cleanDogHighlights(b) {
  const parts = [];
  if (b.medications) parts.push(`תרופה: ${b.medications}`);
  if (b.special_diet || b.specialDiet) parts.push(`מזון: ${b.special_diet || b.specialDiet}`);

  const rawNotes = b.notes || b.behavior_notes || b.behaviorNotes || '';
  const cleanParts = rawNotes
    .split('|')
    .map(p => p.trim())
    .filter(p => 
      p &&
      !p.includes('עסקת Grow') &&
      !p.includes('אסמכתא:') &&
      !p.includes('ציטוט מוואטסאפ') &&
      !p.includes('שיחת וואטסאפ') &&
      !p.includes('תקנון הריזורט') &&
      !p.includes('לקוח חדש') &&
      !p.includes('https://')
    );
  if (cleanParts.length > 0) {
    parts.push(cleanParts.join(', '));
  }
  return parts.join(' | ');
}

function formatTomorrowOverviewReport(
  managerName,
  bookings,
  settings,
  intakeRequests,
  refDateStr = '2026-09-18'
) {
  const tomorrowStr = addDays(refDateStr, 1);
  const dayName = getDayNameHebrew(tomorrowStr);
  const formattedDate = formatDateIL(tomorrowStr);

  const activeBookings = bookings.filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

  // Incoming dogs tomorrow
  const incomingDogs = activeBookings.filter(b => (b.start_date || b.startDate) === tomorrowStr);

  // Departing dogs tomorrow
  const departingDogs = activeBookings.filter(b => (b.end_date || b.endDate) === tomorrowStr);

  // Dogs staying overnight at end of tomorrow
  const endOfDayDogs = activeBookings.filter(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    return start <= tomorrowStr && end > tomorrowStr;
  });

  // Dogs present during day tomorrow
  const presentDaytimeDogs = activeBookings.filter(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    return start <= tomorrowStr && end >= tomorrowStr;
  });

  const maxCapacity = Number(settings.max_capacity || settings.maxCapacity) || 10;
  const occupancyPercent = maxCapacity > 0 ? Math.round((endOfDayDogs.length / maxCapacity) * 100) : 0;
  const growPaymentLink = settings.growPaymentLink || settings.grow_payment_link || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

  const isTrainingBooking = (b) => {
    const s = b.service_type || b.serviceType || '';
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

  const formatDogItem = (b, index, isIncoming) => {
    const dogName = b.dog_name || b.dogName || 'כלב';
    const breed = b.dog_breed || b.dogBreed;
    const breedStr = breed ? ` (${breed})` : '';
    const ownerName = b.owner_name || b.ownerName || 'בעלים';
    const ownerPhone = b.owner_phone || b.ownerPhone || '';
    const sType = b.service_type || b.serviceType || 'boarding';
    const isTraining = isTrainingBooking(b);
    
    let serviceLabel = 'פנסיון 🏨';
    if (sType === 'training') serviceLabel = isIncoming ? 'תהליך אילוף 🎓' : 'משתחרר מתהליך אילוף 🎓';
    else if (sType === 'day_training') serviceLabel = isIncoming ? 'אילוף יומי (ללא לינה) 🎓' : 'משתחרר מאילוף יומי 🎓';
    else if (sType === 'daycare') serviceLabel = isIncoming ? 'יום כיף (ללא לינה) 🎾' : 'משתחרר מיום כיף 🎾';
    else serviceLabel = isIncoming ? 'פנסיון 🏨' : 'משתחרר מפנסיון 🏨';

    const totalPrice = Number(b.total_price || b.totalPrice) || 0;
    const depositAmount = Number(b.deposit_amount || b.depositAmount) || 0;
    const remainingDebt = Math.max(0, totalPrice - depositAmount);
    const isPaid = (b.payment_status === 'fully_paid' || b.paymentStatus === 'fully_paid') || remainingDebt <= 0;

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
      const isFemale = Boolean((b.dog_gender || b.dogGender)?.includes('female'));
      const stayDescription = isTraining ? 'תהליך האילוף' : 'השהות בריזורט';

      let demandMsg = '';
      if (isIncoming) {
        demandMsg = `היי ${firstName}! 🐾\nמתרגשים ומחכים מחר לתחילת ${stayDescription} של ${dogName} בריזורט לכלב! 🐶❤️\n\nלקראת ההגעה מחר, נשמח להסדרת יתרת התשלום בסך ₪${remainingDebt.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${growPaymentLink}\n\nמחכים לכם בשמחה,\nשמוליק וצוות הריזורט לכלב 🐾✨`;
      } else {
        const finishVerb = isFemale ? 'מסיימת' : 'מסיים';
        const enjoyVerb = isFemale ? 'נהנתה' : 'נהנה';
        const missVerb = isFemale ? 'מתגעגעת' : 'מתגעגע';
        demandMsg = `היי ${firstName}! 🐾\nרצינו לעדכן שמחר ${dogName} ${finishVerb} את ${stayDescription} בריזורט לכלב! 🐕🥰 ${enjoyVerb} מכל רגע ו${missVerb} אליכם מאוד.\n\nלקראת האיסוף והשחרור מחר, נשמח להסדרת יתרת התשלום בסך ₪${remainingDebt.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${growPaymentLink}\n\nתודה רבה ונתראה מחר,\nשמוליק וצוות הריזורט לכלב 🐾✨`;
      }

      const waLink = `https://wa.me/${intlPhone}?text=${encodeURIComponent(demandMsg)}`;
      linkLine = `\n   📲 *דרישת תשלום בוואטסאפ (לעריכה ושליחה):*\n   ${waLink}`;
    }

    const hl = cleanDogHighlights(b);
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
    const incParts = [];

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
    const depParts = [];

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
  const highlights = [];

  // Medical notes
  const dogsWithMeds = presentDaytimeDogs.filter(b => b.medications || b.special_diet || b.specialDiet);
  if (dogsWithMeds.length > 0) {
    const medsList = dogsWithMeds.map(b => `${b.dog_name || b.dogName} (${b.medications || b.special_diet || b.specialDiet})`).join(', ');
    highlights.push(`💊 *תרופות ומזון מיוחד:* ${medsList}`);
  }

  // Pending questionnaires
  const pendingIntakes = (intakeRequests || []).filter(r => r.status === 'pending');
  if (pendingIntakes.length > 0) {
    highlights.push(`📥 *שאלונים חדשים לבדיקה:* ${pendingIntakes.length} שאלונים ממתינים`);
  }

  let highlightsSection = '';
  if (highlights.length > 0) {
    highlightsSection = `\n\n⭐ *דגשים ודברים חשובים נוספים:*\n${highlights.map(h => `• ${h}`).join('\n')}`;
  }

  const occupancyStatus = endOfDayDogs.length >= maxCapacity
    ? '• 🔥 *תפוסה מלאה בריזורט!*'
    : `• נותרו עוד *${maxCapacity - endOfDayDogs.length}* מקומות פנויים ללינה מחר.`;

  // Overnight names breakdown
  const boardingOvernightNames = endOfDayBoarding.map(b => b.dog_name || b.dogName).filter(Boolean);
  const trainingOvernightNames = endOfDayTraining.map(b => b.dog_name || b.dogName).filter(Boolean);

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

async function runTest() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsData } = await supabase.from('settings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const s = settingsData[0] || {};
  const sData = { ...s, ...(s.data || {}) };

  console.log('--- TEST 1: Tomorrow from 2026-09-18 (which is Saturday 2026-09-19) ---');
  const msg19 = formatTomorrowOverviewReport('שמוליק', bookings, sData, intakes, '2026-09-18');
  console.log(msg19);

  console.log('\n======================================================\n');
  console.log('--- TEST 2: Tomorrow from 2026-09-21 (which is Tuesday 2026-09-22, 4 incoming & 3 departing with debts) ---');
  const msg22 = formatTomorrowOverviewReport('שמוליק', bookings, sData, intakes, '2026-09-21');
  console.log(msg22);
}

runTest();

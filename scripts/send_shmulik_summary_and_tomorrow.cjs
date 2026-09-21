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
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

function isValidIsraeliPhone(phone) {
  if (!phone) return false;
  const cleaned = cleanPhoneNumber(phone);
  return /^05\d{8}$/.test(cleaned);
}

function getTodayIsraelStr() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dtf.format(now);
}

function getFirstName(fullName) {
  if (!fullName) return 'לקוח';
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function extractMeaningfulHighlights(b) {
  const parts = [];
  const meds = (b.medications || '').trim();
  if (meds && !meds.includes('אין') && !meds.includes('בריא')) {
    parts.push(`תרופה: ${meds}`);
  }
  const diet = (b.special_diet || b.specialDiet || '').trim();
  if (diet && !diet.includes('אין') && !diet.includes('בריא')) {
    parts.push(`מזון: ${diet}`);
  }

  const rawNotes = [b.notes, b.behavior_notes, b.behaviorNotes].filter(Boolean).join(' | ');
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

  const uniqueClean = Array.from(new Set(cleanParts));
  if (uniqueClean.length > 0) {
    parts.push(uniqueClean.join(', '));
  }
  return parts.join(' | ');
}

function formatTomorrowOverviewReport(
  managerName,
  bookings,
  settings,
  intakeRequests,
  todayStr = getTodayIsraelStr()
) {
  const tomorrowStr = addDays(todayStr, 1);
  const dayName = getDayNameHebrew(tomorrowStr);
  const formattedDate = formatDateIL(tomorrowStr);
  const cleanManager = managerName && managerName !== 'מנהל' ? managerName : 'שמוליק';

  const safeIntakes = (intakeRequests && Array.isArray(intakeRequests) && intakeRequests.length > 0)
    ? intakeRequests
    : (settings.intakeRequests || (settings.data && settings.data.intakeRequests) || []);

  const activeBookings = bookings.filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

  const deduplicateBookings = (list) => {
    const seen = new Set();
    return list.filter(b => {
      const phone = (b.owner_phone || b.ownerPhone || '').replace(/\D/g, '');
      const dog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const key = `${phone}_${dog}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const incomingDogs = deduplicateBookings(activeBookings.filter(b => (b.start_date || b.startDate) === tomorrowStr));
  const departingDogs = deduplicateBookings(activeBookings.filter(b => (b.end_date || b.endDate) === tomorrowStr));
  const endOfDayDogs = deduplicateBookings(activeBookings.filter(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    return start <= tomorrowStr && end > tomorrowStr;
  }));
  const presentDaytimeDogs = deduplicateBookings(activeBookings.filter(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    return start <= tomorrowStr && end >= tomorrowStr;
  }));

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

  // Helper function to build pleasant debt reminder WhatsApp link
  const buildDebtPaymentWhatsAppUrl = (b, isEnteringTomorrow) => {
    const phone = b.owner_phone || b.ownerPhone || '';
    const cleanPhone = cleanPhoneNumber(phone);
    if (!cleanPhone) return '';

    const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
    const ownerFirst = getFirstName(b.owner_name || b.ownerName);
    const dog = b.dog_name || b.dogName || 'הכלב';
    const total = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const balance = Math.max(0, total - deposit);

    let messageText = '';
    if (isEnteringTomorrow) {
      messageText = `היי ${ownerFirst}! 🐾\nמתרגשים ומחכים מחר לתחילת השהות של ${dog} בריזורט לכלב! 🐶❤️\n\nלקראת ההגעה מחר, נשמח להסדרת יתרת התשלום בסך ₪${balance.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${growPaymentLink}\n\nמחכים לכם בשמחה,\nשמוליק וצוות הריזורט לכלב 🐾✨`;
    } else {
      messageText = `היי ${ownerFirst}! 🐾\nרצינו לעדכן שמחר ${dog} מסיים/ת את השהות בריזורט לכלב! 🐕🥰 נהנה/תה מכל רגע ומתגעגע/ת אליכם מאוד.\n\nלקראת האיסוף והשחרור מחר, נשמח להסדרת יתרת התשלום בסך ₪${balance.toLocaleString()}.\nלתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:\n👉 ${growPaymentLink}\n\nתודה רבה ונתראה מחר,\nשמוליק וצוות הריזורט לכלב 🐾✨`;
    }

    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(messageText)}`;
  };

  const formatDogItem = (b, idx, isEntering) => {
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const phone = b.owner_phone || b.ownerPhone || '';
    const time = (isEntering ? (b.arrival_time || b.arrivalTime) : (b.pickup_time || b.pickupTime)) || 'לא צוינה שעה';
    const sType = b.service_type || b.serviceType;
    const serviceName = isTrainingBooking(b) ? '🎓 אילוף' : '🏨 פנסיון';
    const dates = `${formatDateIL(b.start_date || b.startDate)} עד ${formatDateIL(b.end_date || b.endDate)}`;
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay || (b.data && b.data.isFreeStay);
    const balance = isFree ? 0 : Math.max(0, price - deposit);

    let paymentBadge = '';
    let quickPaymentLinkLine = '';

    if (isFree) {
      paymentBadge = ' | 🟢 *אירוח ללא עלות (חינם)*';
    } else if (balance === 0 && price > 0) {
      paymentBadge = ' | 🟢 *שולם במלואו (יתרה: ₪0)*';
    } else if (deposit > 0 && balance > 0) {
      paymentBadge = ` | 🟡 *שולמה מקדמה:* ₪${deposit.toLocaleString()} (נותרה יתרה לתשלום: *₪${balance.toLocaleString()}*)`;
      const waUrl = buildDebtPaymentWhatsAppUrl(b, isEntering);
      if (waUrl) {
        quickPaymentLinkLine = `\n   📲 *תזכורת תשלום בוואטסאפ ל${owner}:* ${waUrl}`;
      }
    } else if (price > 0 && deposit === 0) {
      paymentBadge = ` | 🔴 *טרם שולם כלל:* ₪0 מקדמה (חוב: *₪${price.toLocaleString()}*)`;
      const waUrl = buildDebtPaymentWhatsAppUrl(b, isEntering);
      if (waUrl) {
        quickPaymentLinkLine = `\n   📲 *תזכורת תשלום בוואטסאפ ל${owner}:* ${waUrl}`;
      }
    }

    const highlights = extractMeaningfulHighlights(b);
    const highlightsLine = highlights ? `\n   ⚠️ *דגשים:* ${highlights}` : '';

    return `${idx + 1}. 🐕 *${dog}* (${owner} - 📞 ${phone})\n   🕒 ${time} | ${serviceName} | תאריכים: ${dates}${paymentBadge}${quickPaymentLinkLine}${highlightsLine}`;
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

  const highlights = [];
  const dogsWithMeds = presentDaytimeDogs.filter(b => {
    const meds = (b.medications || '').trim();
    const diet = (b.special_diet || b.specialDiet || '').trim();
    return (meds && !meds.includes('אין') && !meds.includes('בריא')) || 
           (diet && !diet.includes('אין') && !diet.includes('בריא'));
  });

  if (dogsWithMeds.length > 0) {
    const medsList = dogsWithMeds.map(b => `${b.dog_name || b.dogName} (${[b.medications, b.special_diet || b.specialDiet].filter(Boolean).join(', ')})`).join(' | ');
    highlights.push(`💊 *תרופות ומזון מיוחד:* ${medsList}`);
  }

  const pendingIntakes = safeIntakes.filter(r => r.status === 'pending');
  if (pendingIntakes.length > 0) {
    highlights.push(`📥 *שאלונים חדשים לבדיקה:* ${pendingIntakes.length} שאלונים ממתינים`);
  }

  let highlightsSection = '';
  if (highlights.length > 0) {
    highlightsSection = `\n\n⭐ *דגשים ודברים חשובים נוספים:*\n${highlights.map(h => `• ${h}`).join('\n')}`;
  }

  // Comprehensive Sanity & Anomalies Audit (18:30 Check integrated into 19:00 Report)
  const activeUpcoming = bookings.filter(b => {
    const st = b.stay_status || b.stayStatus;
    const end = b.end_date || b.endDate;
    return st !== 'cancelled' && st !== 'checked_out' && end >= todayStr;
  });

  const sanityAnomalies = {
    unpaidUpcoming: [],
    approvedWithoutBooking: [],
    phoneAnomalies: [],
    unhandledIntakes: [],
    duplicateAlerts: [],
    typos: [],
    pricingIssues: [],
    capacityAlerts: [],
    paymentConfigIssues: []
  };

  // 1. Unpaid reservations holding capacity (0 deposit)
  activeUpcoming.forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay || (b.data && b.data.isFreeStay);
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;

    if (price > 0 && deposit === 0 && !isFree) {
      sanityAnomalies.unpaidUpcoming.push({
        dog,
        owner,
        phone,
        dates: `${formatDateIL(start)} עד ${formatDateIL(end)}`,
        price
      });
    }
  });

  // 2. Intake forms approved but no booking in calendar (ghost approved)
  const approvedIntakes = safeIntakes.filter(r => r.status === 'approved');
  approvedIntakes.forEach(ai => {
    const aiDog = (ai.dogName || ai.dog_name || '').trim().toLowerCase();
    const aiPhone = cleanPhoneNumber(ai.ownerPhone || ai.owner_phone || '');
    const hasBooking = bookings.some(b => {
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      const bStart = b.start_date || b.startDate;
      const bEnd = b.end_date || b.endDate;
      const sameDog = bDog === aiDog;
      const samePhone = (aiPhone && bPhone && aiPhone === bPhone);
      const sameDates = (ai.startDate && bStart === ai.startDate && ai.endDate && bEnd === ai.endDate);
      return (sameDog && samePhone) || (sameDog && sameDates);
    });

    if (!hasBooking) {
      sanityAnomalies.approvedWithoutBooking.push({
        dog: ai.dogName || ai.dog_name,
        owner: ai.ownerName || ai.owner_name,
        phone: ai.ownerPhone || ai.owner_phone || '',
        dates: `${formatDateIL(ai.startDate || ai.start_date)} עד ${formatDateIL(ai.endDate || ai.end_date)}`
      });
    }
  });

  // 3. Phone number validity & formatting checks across bookings & intakes
  activeUpcoming.forEach(b => {
    const phone = b.owner_phone || b.ownerPhone;
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    if (phone && !isValidIsraeliPhone(phone)) {
      sanityAnomalies.phoneAnomalies.push(`🐶 הזמנה ל-${dog} (${owner}): טלפון לא תקין "${phone}" (חובה 10 ספרות נייד)`);
    }
  });
  safeIntakes.filter(r => r.status === 'pending' || r.status === 'approved').forEach(r => {
    const phone = r.ownerPhone || r.owner_phone;
    const dog = r.dogName || r.dog_name || 'כלב';
    const owner = r.ownerName || r.owner_name || 'בעלים';
    if (phone && !isValidIsraeliPhone(phone)) {
      sanityAnomalies.phoneAnomalies.push(`📥 שאלון ${dog} (${owner}): טלפון לא תקין "${phone}"`);
    }
  });

  // 4. Typos & date contradictions in bookings AND intake forms
  activeUpcoming.forEach(b => {
    const sType = b.service_type || b.serviceType || '';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';

    if (!start || !end) {
      sanityAnomalies.typos.push(`🐶 ${dog} (${owner}): חסר תאריך כניסה/יציאה חוקי`);
    } else if (end < start) {
      sanityAnomalies.typos.push(`🐶 ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) קודם לכניסה (${formatDateIL(start)})`);
    } else if (sType.includes('training') && start === end) {
      sanityAnomalies.typos.push(`🐶 ${dog} (${owner}): תהליך אילוף הוגדר ליום בודד (${formatDateIL(start)})`);
    }
  });
  safeIntakes.filter(r => r.status === 'pending' || r.status === 'approved').forEach(r => {
    const start = r.startDate || r.start_date;
    const end = r.endDate || r.end_date;
    const dog = r.dogName || r.dog_name || 'כלב';
    const owner = r.ownerName || r.owner_name || 'בעלים';
    const sType = r.serviceType || r.service_type || '';

    if (!start || !end) {
      sanityAnomalies.typos.push(`📥 שאלון ${dog} (${owner}): חסר תאריך כניסה/יציאה`);
    } else if (end < start) {
      sanityAnomalies.typos.push(`📥 שאלון ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) קודם לכניסה (${formatDateIL(start)})`);
    } else if (sType === 'training' && start === end) {
      sanityAnomalies.typos.push(`📥 שאלון ${dog} (${owner}): תהליך אילוף הוגדר ליום בודד (${formatDateIL(start)})`);
    }
  });

  // 5. Unhandled pending intake requests
  const pendingIntakesList = safeIntakes.filter(r => r.status === 'pending');
  pendingIntakesList.forEach(r => {
    sanityAnomalies.unhandledIntakes.push({
      dog: r.dogName || r.dog_name,
      owner: r.ownerName || r.owner_name,
      phone: r.ownerPhone || r.owner_phone || '',
      dates: `${formatDateIL(r.startDate || r.start_date)} עד ${formatDateIL(r.endDate || r.end_date)}`
    });
  });

  // 6. Payment Link Configuration Sanity (100% link based)
  const effectiveGrowLink = settings.growPaymentLink || settings.grow_payment_link || settings.payboxPaymentLink;
  if (!effectiveGrowLink || !effectiveGrowLink.includes('http')) {
    sanityAnomalies.paymentConfigIssues.push('חסר קישור תשלום פעיל בהגדרות (Grow Link)! לקוחות לא יכולים לשלם.');
  }

  // 7. Pricing anomalies
  activeUpcoming.forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const isFree = b.is_free_stay || b.isFreeStay || (b.data && b.data.isFreeStay);

    if (price <= 0 && !isFree) {
      sanityAnomalies.pricingIssues.push(`🐶 ${dog} (${owner}): סך הכל לתשלום ₪0 (לא סומן אירוח חינם)`);
    }
    if (deposit > price && price > 0) {
      sanityAnomalies.pricingIssues.push(`🐶 ${dog} (${owner}): מקדמה (₪${deposit}) גדולה מסך ההזמנה (₪${price})`);
    }
  });

  // 8. Advanced Duplicate Detection (Same owner OR Cross-Owner/Partner Ghost Bookings like Boss)
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

      const hasOverlap = (s1 <= e2 && e1 >= s2);
      if (!hasOverlap) continue;

      const phone1 = (b1.owner_phone || b1.ownerPhone || '').replace(/\D/g, '');
      const phone2 = (b2.owner_phone || b2.ownerPhone || '').replace(/\D/g, '');
      const owner1 = b1.owner_name || b1.ownerName || 'בעלים 1';
      const owner2 = b2.owner_name || b2.ownerName || 'בעלים 2';

      if (phone1 && phone1 === phone2) {
        sanityAnomalies.duplicateAlerts.push(`👥 כפילות זהה ביומן: הכלב "${b1.dog_name || b1.dogName}" (${owner1}) מופיע פעמיים בתאריכים חופפים (${formatDateIL(s1)}-${formatDateIL(e1)})`);
        continue;
      }

      const dep1 = Number(b1.deposit_amount || b1.depositAmount) || 0;
      const dep2 = Number(b2.deposit_amount || b2.depositAmount) || 0;
      const isSingleDay1 = s1 === e1;
      const isSingleDay2 = s2 === e2;
      const isSuspiciousGhost = (dep1 === 0 && isSingleDay1) || (dep2 === 0 && isSingleDay2) || (s1 === s2);

      if (isSuspiciousGhost) {
        sanityAnomalies.duplicateAlerts.push(`🚨 *חשד לכפילות שותפים/רשומת רפאים:* הכלב "${b1.dog_name || b1.dogName}" רשום באותו תאריך תחת 2 בעלים שונים!\n      - רשומה 1: ${owner1} (📞 ${b1.owner_phone || b1.ownerPhone}) | ${formatDateIL(s1)}-${formatDateIL(e1)} | מקדמה: ₪${dep1}\n      - רשומה 2: ${owner2} (📞 ${b2.owner_phone || b2.ownerPhone}) | ${formatDateIL(s2)}-${formatDateIL(e2)} | מקדמה: ₪${dep2}`);
      } else {
        sanityAnomalies.duplicateAlerts.push(`💡 שימו לב: 2 כלבים שונים בשם "${b1.dog_name || b1.dogName}" שוהים במקביל (${owner1} מול ${owner2})`);
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

    const overnights = activeUpcoming.filter(b => {
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return s <= dateStr && e > dateStr;
    });

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
      sParts.push(`💳 *הגדרות תשלום (Grow Link):*`);
      sanityAnomalies.paymentConfigIssues.forEach(c => sParts.push(`   • 🚨 ${c}`));
    }

    sanityAuditSection = sParts.join('\n');
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
${occupancyStatus}${highlightsSection}${sanityAuditSection}

שיהיה יום מוצלח, פורה ושקט! ❤️🐶🐾`;
}

async function sendMessages() {
  console.log('Fetching database records...');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsData } = await supabase.from('settings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  const sRow = settingsData[0] || {};
  const s = { ...sRow, ...(sRow.data || {}) };
  const safeIntakes = (intakes && Array.isArray(intakes) && intakes.length > 0) 
    ? intakes 
    : (s.intakeRequests || sRow.data?.intakeRequests || []);

  const id = s.greenApiIdInstance;
  const token = s.greenApiToken;
  const phone = cleanPhoneNumber(s.whatsappNotificationPhone || s.managerPhone || '0506336896');
  const intlPhone = phone.startsWith('0') ? '972' + phone.substring(1) : phone;
  const chatId = intlPhone + '@c.us';

  const isDryRun = process.argv.includes('--dry-run');
  const todayIsrael = getTodayIsraelStr();

  console.log(`Target Shmulik: ${chatId} using GreenAPI: ${id} (Date: ${todayIsrael})`);

  // 1. Message 1: Short summary + new pleasant debt reminder message formats
  const explanationMessage = `היי שמוליק! 🐾 מעדכן אותך בעדכון חשוב במערכת:

⏰ *החל מהיום: סקירת הבוקר עוברת לשעה 19:00 בערב!*
במקום דוח בבוקר, תקבל בכל יום ב-19:00 סקירה מלאה שמכינה אותך לכל מה שקורה מחר (כניסות, שחרורים, יתרות לתשלום, תפוסה ודגשים).

📲 *טיפול ביתרות תשלום ישירות מהוואטסאפ:*
בכל מקרה של יתרת תשלום פתוחה לכלב, מופיע לך קישור ישיר לבעלים. לחיצה עליו פותחת שיחה איתם כשההודעה כבר מוקלדת ומוכנה עבורך – ואתה יכול לערוך כל מילה שתרצה לפני השליחה!

💬 *הנוסחים הנעימים שיופיעו לך לשליחה ללקוחות:*

1️⃣ *לכלב שנכנס מחר (מתחיל שהות):*
"היי {שם הבעלים}! 🐾
מתרגשים ומחכים מחר לתחילת השהות של {שם הכלב} בריזורט לכלב! 🐶❤️

לקראת ההגעה מחר, נשמח להסדרת יתרת התשלום בסך ₪{יתרה}.
לתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:
👉 {קישור לתשלום}

מחכים לכם בשמחה,
שמוליק וצוות הריזורט לכלב 🐾✨"

2️⃣ *לכלב שמשתחרר מחר (מסיים שהות):*
"היי {שם הבעלים}! 🐾
רצינו לעדכן שמחר {שם הכלב} מסיים/ת את השהות בריזורט לכלב! 🐕🥰 נהנה/תה מכל רגע ומתגעגע/ת אליכם מאוד.

לקראת האיסוף והשחרור מחר, נשמח להסדרת יתרת התשלום בסך ₪{יתרה}.
לתשלום מהיר, נוח ומאובטח ב-Bit או כרטיס אשראי:
👉 {קישור לתשלום}

תודה רבה ונתראה מחר,
שמוליק וצוות הריזורט לכלב 🐾✨"

🔒 *מנגנון אפס כפילויות:* המערכת ננעלה הרמטית ב-4 שכבות הגנה כך שלעולם לא תקבל הודעות כפולות!
(מיד נשלחת אליך סקירת מחר לדוגמה ⬇️)`;

  // 2. Message 2: Tomorrow Overview Report
  const tomorrowReport = formatTomorrowOverviewReport('שמוליק', bookings, s, safeIntakes, todayIsrael);

  if (isDryRun) {
    console.log('\n=== DRY RUN MODE: No messages sent to GreenAPI ===');
    console.log('--- Explanation Message ---');
    console.log(explanationMessage);
    console.log('\n--- Tomorrow Report ---');
    console.log(tomorrowReport);
    return;
  }

  console.log('\n--- Sending Message 1 (Summary & Debt Reminder Formulas) ---');
  const res1 = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: explanationMessage })
  });
  const data1 = await res1.json();
  console.log('Result Message 1:', data1);

  console.log('\n--- Sending Message 2 (Tomorrow Overview Report) ---');
  const res2 = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: tomorrowReport })
  });
  const data2 = await res2.json();
  console.log('Result Message 2:', data2);

  // 3. Update Supabase lock so today's report is marked as sent
  try {
    const curData = sRow.data || {};
    await supabase.from('settings').update({
      data: {
        ...curData,
        lastTomorrowOverviewSentDate: todayIsrael,
        lastTomorrowOverviewSentTimestamp: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }).eq('id', sRow.id || 'resort_config');
    console.log('Successfully recorded sent status in Supabase Cloud Settings!');
  } catch (e) {
    console.error('Error updating Supabase:', e);
  }
}

sendMessages();

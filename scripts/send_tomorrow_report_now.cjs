const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

function formatPhoneFormatted(phone) {
  if (!phone) return '';
  const clean = cleanPhoneNumber(phone);
  if (clean.length === 10 && clean.startsWith('05')) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return phone;
}

function formatDateIL(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const day = parts[2].substring(0, 2);
    const month = parts[1];
    const year = parts[0].slice(2);
    return `${day}.${month}.${year}`;
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

function buildTomorrowReport(bookings, settings, intakes, todayStr) {
  const tomorrowStr = addDays(todayStr, 1);
  const tomDate = new Date(tomorrowStr + 'T00:00:00');
  const dayName = HEBREW_DAYS[tomDate.getDay()] || '';
  const formattedDate = formatDateIL(tomorrowStr);

  const activeBookings = (bookings || []).filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

  const deduplicateBookings = (list) => {
    const seen = new Set();
    return list.filter(b => {
      const phone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
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

  const isTraining = (b) => {
    const s = b.service_type || b.serviceType || '';
    return s === 'training' || s === 'day_training' || s === 'combined';
  };

  const incomingBoarding = incomingDogs.filter(b => !isTraining(b));
  const incomingTraining = incomingDogs.filter(b => isTraining(b));
  const departingBoarding = departingDogs.filter(b => !isTraining(b));
  const departingTraining = departingDogs.filter(b => isTraining(b));
  const endOfDayBoarding = endOfDayDogs.filter(b => !isTraining(b));
  const endOfDayTraining = endOfDayDogs.filter(b => isTraining(b));

  const formatDogItem = (b, index, isInc) => {
    const dogName = b.dog_name || b.dogName || 'כלב';
    const breed = b.dog_breed || b.dogBreed;
    const breedStr = breed ? ` (${breed})` : '';
    const ownerName = b.owner_name || b.ownerName || 'בעלים';
    const ownerPhone = formatPhoneFormatted(b.owner_phone || b.ownerPhone || '');
    const sType = b.service_type || b.serviceType || 'boarding';
    let serviceLabel = sType.includes('training') ? (isInc ? 'תהליך אילוף 🎓' : 'משתחרר מאילוף 🎓') : (isInc ? 'פנסיון 🏨' : 'משתחרר מפנסיון 🏨');

    const totalPrice = Number(b.total_price || b.totalPrice) || 0;
    const depositAmount = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;
    const remainingDebt = isFree ? 0 : Math.max(0, totalPrice - depositAmount);
    const isPaid = isFree || (b.payment_status === 'fully_paid' || b.paymentStatus === 'fully_paid') || remainingDebt <= 0;

    let paymentBadge = '';
    let linkLine = '';

    if (isFree) {
      paymentBadge = '🟢 אירוח חינם';
    } else if (isPaid) {
      paymentBadge = `💰 שולם: ₪${(depositAmount || totalPrice).toLocaleString()} (✅ שולם במלואו)`;
    } else if (depositAmount > 0 && remainingDebt > 0) {
      paymentBadge = `💰 שולם: ₪${depositAmount.toLocaleString()} | *נשאר לתשלום: ₪${remainingDebt.toLocaleString()}* ⚠️`;
      const cleanPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      if (cleanPhone) {
        const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
        const firstName = (ownerName || 'לקוח').trim().split(/\s+/)[0];
        const demandMsg = `היי ${firstName}! 🐾 לקראת ההגעה/איסוף מחר בריזורט לכלב, נשמח להסדרת יתרת התשלום בסך ₪${remainingDebt.toLocaleString()}:\n👉 ${growPaymentLink}`;
        linkLine = `\n   📲 *לתשלום בוואטסאפ:* https://wa.me/${intlPhone}?text=${encodeURIComponent(demandMsg)}`;
      }
    } else if (totalPrice > 0 && depositAmount === 0) {
      paymentBadge = `🔴 *לא שולם (חוב: ₪${totalPrice.toLocaleString()})* ⚠️`;
      const cleanPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      if (cleanPhone) {
        const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
        const firstName = (ownerName || 'לקוח').trim().split(/\s+/)[0];
        const demandMsg = `היי ${firstName}! 🐾 לקראת ההגעה/איסוף מחר בריזורט לכלב, נשמח להסדרת יתרת התשלום בסך ₪${totalPrice.toLocaleString()}:\n👉 ${growPaymentLink}`;
        linkLine = `\n   📲 *לתשלום בוואטסאפ:* https://wa.me/${intlPhone}?text=${encodeURIComponent(demandMsg)}`;
      }
    }

    const meds = b.medications || b.special_diet || '';
    const mLine = meds ? `\n   💊 דגש: ${meds}` : '';

    return `${index + 1}. 🐶 *${dogName}*${breedStr} | 🏷️ ${serviceLabel}\n   👤 בעלים: ${ownerName} (📞 ${ownerPhone})\n   ${paymentBadge}${linkLine}${mLine}`;
  };

  let incomingSection = incomingDogs.length === 0
    ? '• אין כניסות מתוכננות למחר (0 פנסיון | 0 אילוף).'
    : `🏨 *כניסות לפנסיון (${incomingBoarding.length}):*\n${incomingBoarding.length > 0 ? incomingBoarding.map((b, i) => formatDogItem(b, i, true)).join('\n\n') : '• אין כניסות לפנסיון'}\n\n🎓 *כניסות לאילוף (${incomingTraining.length}):*\n${incomingTraining.length > 0 ? incomingTraining.map((b, i) => formatDogItem(b, i, true)).join('\n\n') : '• אין כניסות לאילוף'}`;

  let departingSection = departingDogs.length === 0
    ? '• אין שחרורים מתוכננים למחר (0 פנסיון | 0 אילוף).'
    : `🏨 *שחרורים מפנסיון (${departingBoarding.length}):*\n${departingBoarding.length > 0 ? departingBoarding.map((b, i) => formatDogItem(b, i, false)).join('\n\n') : '• אין שחרורים מפנסיון'}\n\n🎓 *שחרורים מאילוף (${departingTraining.length}):*\n${departingTraining.length > 0 ? departingTraining.map((b, i) => formatDogItem(b, i, false)).join('\n\n') : '• אין שחרורים מאילוף'}`;

  // Action items / Red lights for tomorrow
  const actionBlocks = [];

  // 1. Unhandled Intakes (Pending, In Progress, Payment Requested) - FIRST PRIORITY
  const unhandledIntakes = (intakes || []).filter(r => {
    const st = r.status;
    if (st === 'approved' || st === 'rejected' || st === 'archived') return false;
    const rStart = r.startDate || r.start_date || '';
    const rEnd = r.endDate || r.end_date || '';
    // Auto-archive rule: if dates have already passed without a booking, ignore from report
    if ((rEnd && rEnd < todayStr) || (rStart && rStart < todayStr)) return false;

    const rDog = (r.dogName || r.dog_name || '').trim().toLowerCase();
    const rPhone = cleanPhoneNumber(r.ownerPhone || r.owner_phone || '');
    const hasBooking = activeBookings.some(b => {
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      return (rDog && bDog && rDog === bDog && (bPhone.slice(-7) === rPhone.slice(-7) || !rPhone));
    });
    return !hasBooking;
  });

  if (unhandledIntakes.length > 0) {
    const pList = unhandledIntakes.map((pi, idx) => {
      const dog = pi.dogName || pi.dog_name || 'כלב';
      const owner = pi.ownerName || pi.owner_name || 'בעלים';
      const phone = formatPhoneFormatted(pi.ownerPhone || pi.owner_phone || '');
      const sDate = formatDateIL(pi.startDate || pi.start_date);
      const eDate = formatDateIL(pi.endDate || pi.end_date);
      let statusBadge = '🔴 לבדיקה';
      if (pi.status === 'in_progress') statusBadge = '🟡 בתהליך';
      else if (pi.status === 'payment_requested') statusBadge = '💳 נשלח קישור לתשלום';
      return `${idx + 1}. ${statusBadge}: *${dog}* (${owner} - 📞 ${phone}) | מיועד: ${sDate} עד ${eDate}`;
    }).join('\n');
    actionBlocks.push(`📋 *שאלוני קליטה לבדיקה / בתהליך שממתינים לטיפול וסגירה (${unhandledIntakes.length}):*\n${pList}\n👉 *שמוליק, אנא היכנס למסך שאלוני קליטה כדי לאשר, לקלוט ליומן או לסגור טיפול.*`);
  }

  // 2. Approved intakes without calendar booking
  const approvedIntakesWithoutBooking = (intakes || []).filter(ai => {
    if (ai.status !== 'approved') return false;
    const aiStart = ai.startDate || ai.start_date || '';
    const aiEnd = ai.endDate || ai.end_date || '';
    // Auto-archive rule: if dates have already passed without a booking, ignore from report
    if ((aiEnd && aiEnd < todayStr) || (aiStart && aiStart < todayStr)) return false;

    const aiDog = (ai.dogName || ai.dog_name || '').trim().toLowerCase();
    const aiPhone = cleanPhoneNumber(ai.ownerPhone || ai.owner_phone || '');
    return !activeBookings.some(b => {
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      const bStart = b.start_date || b.startDate;
      const bEnd = b.end_date || b.endDate;
      const sameDog = bDog === aiDog;
      const samePhone = (aiPhone && bPhone && aiPhone === bPhone);
      const sameDates = ((ai.startDate || ai.start_date) && bStart === (ai.startDate || ai.start_date) && (ai.endDate || ai.end_date) && bEnd === (ai.endDate || ai.end_date));
      return (sameDog && samePhone) || (sameDog && sameDates);
    });
  });

  if (approvedIntakesWithoutBooking.length > 0) {
    const list = approvedIntakesWithoutBooking.map((ai, idx) => {
      const dog = ai.dogName || ai.dog_name || 'כלב';
      const owner = ai.ownerName || ai.owner_name || 'בעלים';
      const phone = formatPhoneFormatted(ai.ownerPhone || ai.owner_phone || '');
      const dates = `${formatDateIL(ai.startDate || ai.start_date)} עד ${formatDateIL(ai.endDate || ai.end_date)}`;
      return `${idx + 1}. ⚠️ *${dog}* (${owner} - 📞 ${phone}) | ${dates}`;
    }).join('\n');
    actionBlocks.push(`⚠️ *שאלונים שאושרו אך טרם שוריינו ביומן (${approvedIntakesWithoutBooking.length}):*\n${list}`);
  }

  // 3. Unassigned kennel placement check (חוק ברזל: חובת שיבוץ מיקום לינה)
  const unassignedKennelDogs = activeBookings.filter(b => {
    const s = b.start_date || b.startDate;
    const e = b.end_date || b.endDate;
    const k = b.kennel_number || b.kennelNumber || b.data?.kennelNumber || b.data?.kennel;
    return isStayingOrIncoming && !k;
  });

  if (unassignedKennelDogs.length > 0) {
    const list = unassignedKennelDogs.map((b, idx) => {
      const phone = formatPhoneFormatted(b.owner_phone || b.ownerPhone || '');
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return `${idx + 1}. 📋 *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${phone}) | שהייה: ${formatDateIL(s)}–${formatDateIL(e)} (ממתין לשיבוץ חדר 1–7, סוויטה 1–4, שביל או הלנה ביתית ודלי מזון)`;
    }).join('\n');
    actionBlocks.push(`🏠 *כלבים הממתינים לשיבוץ מיקום לינה ודלי מזון (${unassignedKennelDogs.length}):*\n${list}`);
  }

  // 4. Zero Deposit bookings holding spots
  const zeroDepositUpcoming = activeBookings.filter(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;
    const end = b.end_date || b.endDate || '';
    return price > 0 && deposit === 0 && !isFree && end >= todayStr;
  });
  if (zeroDepositUpcoming.length > 0) {
    const list = zeroDepositUpcoming.map((b, idx) => {
      const phone = formatPhoneFormatted(b.owner_phone || b.ownerPhone || '');
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      const price = Number(b.total_price || b.totalPrice) || 0;
      return `${idx + 1}. 🔴 *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${phone}) | ${formatDateIL(s)}–${formatDateIL(e)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`;
    }).join('\n');
    actionBlocks.push(`🔴 *שריונים ללא מקדמה (₪0) שתופסים מקום ביומן (${zeroDepositUpcoming.length}):*\n${list}`);
  }

  // 5. Pricing & calculation discrepancies
  const financialDiscrepancies = [];
  activeBookings.forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;
    const dailyRate = Number(b.daily_rate || b.dailyRate) || 0;
    const dog = (b.dog_name || b.dogName || '').trim();
    const owner = (b.owner_name || b.ownerName || '').trim();
    const sType = b.service_type || b.serviceType || '';
    const pMode = b.pricing_mode || b.pricingMode || '';
    const sDate = b.start_date || b.startDate;
    const eDate = b.end_date || b.endDate;

    const isMultiDog = dog.includes(' ו') || dog.includes(' + ') || dog.includes(' and ');
    if (isMultiDog && pMode !== 'period' && sType !== 'training' && !isFree) {
      financialDiscrepancies.push(`🐶🐶 תמחור זוג כלבים: *${dog}* (${owner}) | נדרש לוודא שהתמחור מוגדר כ'מחיר פיקס/לתקופה' הכולל את שני הכלבים.`);
    }
  });

  if (financialDiscrepancies.length > 0) {
    actionBlocks.push(`💰 *אי-התאמות כספיות / תמחור שדורש בדיקה:*\n• ${financialDiscrepancies.join('\n• ')}`);
  }

  let extraActionSections = '';
  if (actionBlocks.length > 0) {
    extraActionSections = '\n\n🚨 *אורות אדומים ופעולות דחופות:*\n' + actionBlocks.join('\n\n');
  } else {
    extraActionSections = '\n\n🚨 *אורות אדומים:* אין אורות אדומים ✅';
  }

  const boardingOvernightNames = endOfDayBoarding.map(b => b.dog_name || b.dogName).filter(Boolean);
  const trainingOvernightNames = endOfDayTraining.map(b => b.dog_name || b.dogName).filter(Boolean);

  return `📋 *מה קורה מחר? סקירה יומית לשמוליק – הריזורט לכלב* 🐾
📅 יום ${dayName}, ${formattedDate} | הפקה: 19:00

🟢 *סה״כ כלבים שנכנסים מחר: ${incomingDogs.length}* (🏨 ${incomingBoarding.length} | 🎓 ${incomingTraining.length})
${incomingSection}

🔴 *סה״כ כלבים שמשתחררים מחר: ${departingDogs.length}* (🏨 ${departingBoarding.length} | 🎓 ${departingTraining.length})
${departingSection}

━━━━━━━━━━━━━━━━━━━━━━━━
🐕 *כמה כלבים יהיו לי מחר בסוף היום: ${endOfDayDogs.length} כלבים ללינה*
• 🏨 *פנסיון ללינה (${endOfDayBoarding.length}):* ${boardingOvernightNames.join(', ') || '0 כלבים'}
• 🎓 *אילוף ללינה (${endOfDayTraining.length}):* ${trainingOvernightNames.join(', ') || '0 כלבים'}
━━━━━━━━━━━━━━━━━━━━━━━━

📊 *סה״כ כלבים שנמצאים מחר: ${presentDaytimeDogs.length} כלבים*

📈 *סיכום תפוסת לינה מחר:*
• *${endOfDayDogs.length} מתוך ${maxCapacity} מקומות* (${occupancyPercent}% תפוסה)
${endOfDayDogs.length >= maxCapacity ? '• 🔥 *תפוסה מלאה בריזורט!*' : `• נותרו עוד *${maxCapacity - endOfDayDogs.length}* מקומות פנויים.`}${extraActionSections}

שיהיה יום מוצלח, פורה ושקט! ❤️🐶🐾`;
}

async function sendTomorrowReportNow() {
  const todayStr = getTodayIsraelStr();
  console.log(`מפיק ושולח את דוח "מה קורה מחר?" עבור ${todayStr}...`);

  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: intakesRows } = await supabase.from('intake_requests').select('*');

  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };

  // Merge intakes from intake_requests table and settings.data.intakeRequests
  const rawFromSettings = (sRow && sRow.data && Array.isArray(sRow.data.intakeRequests)) ? sRow.data.intakeRequests : [];
  const intakeMap = new Map();
  [...rawFromSettings, ...(intakesRows || [])].forEach(item => {
    if (item && item.id) {
      intakeMap.set(item.id, item);
    }
  });
  const intakes = Array.from(intakeMap.values());

  const greenId = settings.greenApiIdInstance || '710722735421';
  const greenToken = settings.greenApiToken || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  const reportText = buildTomorrowReport(bookings, settings, intakes, todayStr);

  const recipients = [
    { name: 'שמוליק', phone: '050-6336896', chatId: '972506336896@c.us' },
    { name: 'מנהל', phone: '054-3200007', chatId: '972543200007@c.us' }
  ];

  for (const r of recipients) {
    console.log(`שולח דוח אל ${r.name} (${r.phone})...`);
    const res = await fetch(`https://api.green-api.com/waInstance${greenId}/sendMessage/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: r.chatId, message: reportText })
    });
    const resData = await res.json();
    console.log(`תוצאת משלוח אל ${r.name}:`, resData);
  }

  // Update Supabase
  try {
    const curData = sRow.data || {};
    await supabase.from('settings').update({
      data: {
        ...curData,
        lastTomorrowOverviewSentDate: todayStr,
        lastTomorrowOverviewSentTimestamp: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }).eq('id', sRow.id || 'resort_config');
    console.log('תיעוד הדוח נשמר בהצלחה ב-Supabase!');
  } catch (e) {
    console.warn('שגיאה בעדכון Supabase:', e.message);
  }
}

sendTomorrowReportNow();

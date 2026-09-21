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

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  return cleaned;
}

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
  todayStr = '2026-09-19'
) {
  const tomorrowStr = addDays(todayStr, 1);
  const dayName = getDayNameHebrew(tomorrowStr);
  const formattedDate = formatDateIL(tomorrowStr);

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

    const hl = extractMeaningfulHighlights(b);
    const hlLine = hl ? `\n   🩺 *דגשים:* ${hl}` : '';

    return `${index + 1}. 🐶 *${dogName}*${breedStr} | 🏷️ ${serviceLabel}
   👤 בעלים: ${ownerName} (📞 ${ownerPhone})
   ${paymentLine}${linkLine}${hlLine}`;
  };

  let incomingSection = '';
  if (incomingDogs.length === 0) {
    incomingSection = '• אין כניסות מתוכננות למחר (0 פנסיון | 0 אילוף).';
  } else {
    const incParts = [];
    incParts.push(`🏨 *כניסות לפנסיון (${incomingBoarding.length}):*`);
    if (incomingBoarding.length > 0) {
      incParts.push(incomingBoarding.map((b, i) => formatDogItem(b, i, true)).join('\n\n'));
    } else {
      incParts.push('• אין כניסות לפנסיון מחר.');
    }
    incParts.push(`\n🎓 *כניסות לאילוף (${incomingTraining.length}):*`);
    if (incomingTraining.length > 0) {
      incParts.push(incomingTraining.map((b, i) => formatDogItem(b, i, true)).join('\n\n'));
    } else {
      incParts.push('• אין כניסות לאילוף מחר.');
    }
    incomingSection = incParts.join('\n');
  }

  let departingSection = '';
  if (departingDogs.length === 0) {
    departingSection = '• אין שחרורים מתוכננים למחר (0 פנסיון | 0 אילוף).';
  } else {
    const depParts = [];
    depParts.push(`🏨 *שחרורים מפנסיון (${departingBoarding.length}):*`);
    if (departingBoarding.length > 0) {
      depParts.push(departingBoarding.map((b, i) => formatDogItem(b, i, false)).join('\n\n'));
    } else {
      depParts.push('• אין שחרורים מפנסיון מחר.');
    }
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

  const pendingIntakes = (intakeRequests || []).filter(r => r.status === 'pending');
  if (pendingIntakes.length > 0) {
    highlights.push(`📥 *שאלונים חדשים לבדיקה:* ${pendingIntakes.length} שאלונים ממתינים`);
  }

  let highlightsSection = '';
  if (highlights.length > 0) {
    highlightsSection = `\n\n⭐ *דגשים ודברים חשובים נוספים:*\n${highlights.map(h => `• ${h}`).join('\n')}`;
  }

  // Critical Policy: No deposit = No reservation!
  const unpaidUpcoming = bookings.filter(b => {
    const status = b.stay_status || b.stayStatus;
    const end = b.end_date || b.endDate;
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    return status !== 'cancelled' && status !== 'checked_out' && end >= todayStr && price > 0 && deposit === 0;
  });

  let depositAlertSection = '';
  if (unpaidUpcoming.length > 0) {
    const listStr = unpaidUpcoming.map(b => {
      const dog = b.dog_name || b.dogName || 'כלב';
      const owner = b.owner_name || b.ownerName || 'בעלים';
      const phone = b.owner_phone || b.ownerPhone || '';
      const start = b.start_date || b.startDate;
      const end = b.end_date || b.endDate;
      const sType = b.service_type || b.serviceType || '';
      const price = Number(b.total_price || b.totalPrice) || 0;
      const isSingleDayTraining = (sType === 'training' || sType === 'day_training') && start === end;
      const typoWarning = isSingleDayTraining ? ' ⚠️ *[חשד לטעות הקלדה - אילוף ליום בודד!]*' : '';
      return `   • 🔴 *${dog}* (${owner} - ${phone}) | 📅 ${formatDateIL(start)} עד ${formatDateIL(end)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})${typoWarning}`;
    }).join('\n');

    depositAlertSection = `\n\n🚨 *תזכורת נהלים קריטית – אין שיריון מקום ללא מקדמה!*
לפי הנהלים, מקום נשמר אך ורק לאחר תשלום מקדמה!
ישנם ${unpaidUpcoming.length} כלבים ביומן ללא מקדמה כלל שתופסים מקום בתפוסה אך ללא ביטחון שיגיעו. יש לגבות מקדמה דחופה או לפנות את המקום:
${listStr}`;
  } else {
    depositAlertSection = `\n\n📌 *תזכורת נהלים:* שיריון מקום בריזורט תקף אך ורק לאחר תשלום מקדמה בפועל. ללא מקדמה לא נשמר מקום.`;
  }

  const occupancyStatus = endOfDayDogs.length >= maxCapacity
    ? '• 🔥 *תפוסה מלאה בריזורט!*'
    : `• נותרו עוד *${maxCapacity - endOfDayDogs.length}* מקומות פנויים ללינה מחר.`;

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
${occupancyStatus}${highlightsSection}${depositAlertSection}

שיהיה יום מוצלח, פורה ושקט! ❤️🐶🐾`;
}

async function sendMessagesToShmulik() {
  console.log('Fetching database records...');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsData } = await supabase.from('settings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  const sRow = settingsData[0] || {};
  const s = { ...sRow, ...(sRow.data || {}) };

  const id = s.greenApiIdInstance;
  const token = s.greenApiToken;
  const phone = cleanPhoneNumber(s.whatsappNotificationPhone || s.managerPhone || '0506336896');
  const intlPhone = phone.startsWith('0') ? '972' + phone.substring(1) : phone;
  const chatId = intlPhone + '@c.us';

  console.log(`Sending to Shmulik's direct private cell: ${chatId} (${phone}) using GreenAPI instance: ${id}`);

  // 1. Message 1: Alert & Anomalies Update (Boss duplicate explanation + Zeev Afik status query)
  const anomaliesMessage = `היי שמוליק! 🐾 מעדכן אותך בעדכון חשוב ובשני עניינים הדורשים את תשומת ליבך ביומן:

1️⃣ 🐶 *הכלב בוס (תהליך אילוף ב-02.10):*
הייתה ביומן שורת כפילות ליום בודד (02.10) על שם אריאל שרייבר עם ₪0 מקדמה.
מבדיקה מקיפה התברר שאריאל שרייבר ואיתי אהרונסון הם שותפים לאותו הכלב בוס! אריאל מילא את השאלון הראשוני באתר (שיצר שריון זמני), ומיד לאחר מכן איתי הסדיר מקדמה של ₪2,000 ב-Grow עבור תהליך אילוף מלא של 45 יום (02.10 עד 16.11, כניסה שנדחתה עקב השעלת).
כדי למנוע תפיסת מקום כפולה, מחקנו את השורה הכפולה של אריאל, ופרטיו נשמרו כאיש קשר נוסף בהזמנה המקורית של איתי שבה המקדמה כבר שולמה במלואה 🟡.

2️⃣ ⚠️ *חריגה לבירור: יולי (זאב אפיק - 📞 050-7845835):*
הוזמן פנסיון לסופ"ש ראש השנה (02.10 עד 04.10) בסך ₪360, אך שולמה *₪0 מקדמה* (נקודה אדומה 🔴).
בהערות הטופס צוין: "[תאריכים גמישים / בירור זמינות כללי]".
הכלב תופס מקום פריים בחג מבלי שהוסדרה מקדמה כלל כנדרש בנהלים.
👉 *שמוליק, מה תרצה שנעשה לגביו?* האם ליצור איתו קשר ולשלוח קישור לגביית מקדמה מיידית, או לפנות את המקום ללקוחות שממתינים ברשימת ההמתנה?

(מיד נשלחת אליך סקירת מחר היומית ⬇️)`;

  console.log('\n--- Sending Message 1 (Anomalies & Status Update) ---');
  const res1 = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: anomaliesMessage })
  });
  const data1 = await res1.json();
  console.log('Result Message 1:', data1);

  // 2. Message 2: Tomorrow Overview Report (Sunday 20.09)
  const tomorrowReport = formatTomorrowOverviewReport('שמוליק', bookings, s, intakes, '2026-09-19');

  console.log('\n--- Sending Message 2 (Tomorrow Overview Report for 20.09) ---');
  const res2 = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: tomorrowReport })
  });
  const data2 = await res2.json();
  console.log('Result Message 2:', data2);

  // 3. Update Supabase lock so today's report (19.09) is recorded centrally
  try {
    const curData = sRow.data || {};
    await supabase.from('settings').update({
      data: {
        ...curData,
        lastTomorrowOverviewSentDate: '2026-09-19',
        lastTomorrowOverviewSentTimestamp: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }).eq('id', sRow.id || 'resort_config');
    console.log('Successfully recorded sent status for 19.09 in Supabase Cloud Settings!');
  } catch (e) {
    console.error('Error updating Supabase settings:', e);
  }
}

sendMessagesToShmulik();

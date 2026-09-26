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

  // 1. Unassigned kennel placement check (חוק ברזל: חובת שיבוץ מיקום לינה)
  const unassignedKennelDogs = activeBookings.filter(b => {
    const s = b.start_date || b.startDate;
    const e = b.end_date || b.endDate;
    const isStayingOrIncoming = (s <= tomorrowStr && e >= tomorrowStr) || s === tomorrowStr;
    const k = b.kennel_number !== undefined ? b.kennel_number : b.kennelNumber;
    return isStayingOrIncoming && (!k && k !== 0);
  });

  if (unassignedKennelDogs.length > 0) {
    const list = unassignedKennelDogs.map((b, idx) => {
      const phone = formatPhoneFormatted(b.owner_phone || b.ownerPhone || '');
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return `${idx + 1}. 🚨 *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${phone}) | שהייה: ${formatDateIL(s)}–${formatDateIL(e)} (חסר שיבוץ תא 1–11 או הלנה ביתית ודלי מזון!)`;
    }).join('\n');
    actionBlocks.push(`🏠 *כלבים ללא שיבוץ תא לינה ודלי מזון (${unassignedKennelDogs.length}):*\n${list}`);
  }

  // 2. Pending intakes
  const pendingIntakes = (intakes || []).filter(r => r.status === 'pending');
  if (pendingIntakes.length > 0) {
    const pList = pendingIntakes.map((pi, idx) => {
      const dog = pi.dogName || pi.dog_name || 'כלב';
      const owner = pi.ownerName || pi.owner_name || 'בעלים';
      const phone = formatPhoneFormatted(pi.ownerPhone || pi.owner_phone || '');
      const sDate = formatDateIL(pi.startDate || pi.start_date);
      const eDate = formatDateIL(pi.endDate || pi.end_date);
      return `${idx + 1}. 🐕 ${dog} (${owner} - 📞 ${phone}) | ${sDate} עד ${eDate}`;
    }).join('\n');
    actionBlocks.push(`📥 *שאלוני קליטה שממתינים לטיפול (${pendingIntakes.length}):*\n${pList}`);
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

async function testTomorrow() {
  const todayStr = getTodayIsraelStr();
  console.log('Today Israel Str:', todayStr);
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };

  const report = buildTomorrowReport(bookings, settings, intakes, todayStr);
  console.log('\n--- Generated Tomorrow Report ---');
  console.log(report);
}

testTomorrow();

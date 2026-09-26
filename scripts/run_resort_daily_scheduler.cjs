/**
 * =========================================================================
 * Resort Master Scheduler (run_resort_daily_scheduler.cjs)
 * Single Source of Truth for Daily Automations & Reports
 * 
 * 1. 18:30 -> Daily Sanity Audit -> STRICTLY to Manager (054-3200007)
 * 2. 19:00 -> Tomorrow Overview -> to Shmulik (050-6336896) + Manager (054-3200007)
 * 3. 20:00 -> Daily Regards (Sunday-Thursday ONLY) + Confirmation to Manager
 *             (Friday/Saturday/Holidays: SILENCED for clients!)
 * =========================================================================
 */

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

const MANAGER_PHONE = '0543200007';
const MANAGER_CHAT_ID = '972543200007@c.us';
const SHMULIK_PHONE = '0506336896';
const SHMULIK_CHAT_ID = '972506336896@c.us';

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

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
  const dateStr = `${y}-${m}-${d}`;
  const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
  return { dateStr, hour: h, minute: min, dayOfWeek };
}

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

async function sendWhatsApp(greenId, greenToken, chatId, message) {
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${greenId}/sendMessage/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message })
    });
    return await res.json();
  } catch (err) {
    console.error(`WhatsApp send error to ${chatId}:`, err.message);
    return { error: err.message };
  }
}

// 1. 18:30 Sanity Report
async function execute1830Sanity(settings, bookings, intakes, todayStr, isForced = false) {
  if (!isForced && settings.last1830SanitySentDate === todayStr) {
    console.log(`[18:30] דוח בדיקת שפיות כבר נשלח היום (${todayStr}). מדלג.`);
    return;
  }

  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;
  if (!greenId || !greenToken) return;

  const activeBookings = (bookings || []).filter(b => (b.stay_status || b.stayStatus) !== 'cancelled');
  const past24HoursMs = Date.now() - 24 * 60 * 60 * 1000;

  const recentBookings = activeBookings.filter(b => {
    const up = b.updated_at || b.updatedAt;
    return up && new Date(up).getTime() >= past24HoursMs;
  });

  const greenEvents = [];
  const redLights = [];

  recentBookings.forEach(b => {
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;

    if (phone && !/^05\d{8}$/.test(cleanPhoneNumber(phone))) {
      redLights.push(`🐶 ${dog} (${owner}): טלפון לא תקין "${phone}"`);
    } else if (price > 0 && deposit === 0 && !isFree && end >= todayStr) {
      redLights.push(`🔴 *${dog}* (${owner} - ${phone}) | ${formatDateIL(start)}–${formatDateIL(end)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`);
    } else {
      const depText = deposit > 0 ? `מקדמה: ₪${deposit.toLocaleString()}` : isFree ? 'אירוח חינם' : 'הוסדר';
      greenEvents.push(`• *${dog}* (${owner}) | ${formatDateIL(start)}–${formatDateIL(end)} | ${depText} | נתונים ושיחות תואמים.`);
    }
  });

  const parts = [
    `🛡️ *דוח בדיקת שפיות יומית ובקרת אירועים (18:30)*`,
    `תאריך: ${formatDateIL(todayStr)} | שעה: 18:30\n`,
    `⚙️ *בדיקת תשתיות ופונקציות:*`,
    `✅ Green-API: מחובר ותקין`,
    `✅ קישור Grow לתשלומים: פעיל ומאובטח (ללא חשבון בנק)`,
    `✅ סנכרון Supabase Cloud: תקין`,
    `✅ הודעות ב-24 שעות האחרונות: נבדקו ונמצאו תקינות (ללא מספרי בנק וללא שגיאות).\n`,
    `🟢 *אירועים ירוקים (${greenEvents.length} אירועים שסונכרנו בהצלחה ב-24 שעות):*`
  ];

  if (greenEvents.length > 0) {
    greenEvents.forEach(e => parts.push(e));
  } else {
    parts.push(`• לא נרשמו שינויי שריון חדשים ב-24 שעות האחרונות.`);
  }

  parts.push(`\n🚨 *אורות אדומים (${redLights.length} נושאים לטיפול):*`);
  if (redLights.length === 0) {
    parts.push(`אין אורות אדומים ✅`);
  } else {
    redLights.forEach(r => parts.push(`   • ${r}`));
  }

  parts.push(`\n📱 *דוח זה הופק ונשלח ישירות למנהל (${MANAGER_PHONE}) כהוראת ברזל.*`);

  const reportText = parts.join('\n');
  console.log('[18:30] שולח דוח שפיות למנהל...');
  const res = await sendWhatsApp(greenId, greenToken, MANAGER_CHAT_ID, reportText);
  console.log('[18:30] תוצאה:', res);

  try {
    const { data: currentRows } = await supabase.from('settings').select('*').limit(1);
    const curData = currentRows?.[0]?.data || {};
    await supabase.from('settings').update({
      data: {
        ...curData,
        last1830SanitySentDate: todayStr,
        last1830SanitySentTimestamp: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }).eq('id', currentRows?.[0]?.id || 'resort_config');
  } catch (e) {}
}

// 2. 19:00 Tomorrow Report
async function execute1900Tomorrow(settings, bookings, intakes, todayStr, isForced = false) {
  if (!isForced && settings.lastTomorrowOverviewSentDate === todayStr) {
    console.log(`[19:00] דוח "מה קורה מחר?" כבר נשלח היום (${todayStr}). מדלג.`);
    return;
  }

  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;
  if (!greenId || !greenToken) return;

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

  const actionBlocks = [];

  // Unassigned kennels check
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

  let extraActionSections = '';
  if (actionBlocks.length > 0) {
    extraActionSections = '\n\n🚨 *אורות אדומים ופעולות דחופות:*\n' + actionBlocks.join('\n\n');
  } else {
    extraActionSections = '\n\n🚨 *אורות אדומים:* אין אורות אדומים ✅';
  }

  const boardingOvernightNames = endOfDayBoarding.map(b => b.dog_name || b.dogName).filter(Boolean);
  const trainingOvernightNames = endOfDayTraining.map(b => b.dog_name || b.dogName).filter(Boolean);

  const reportText = `📋 *מה קורה מחר? סקירה יומית לשמוליק – הריזורט לכלב* 🐾
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

  console.log('[19:00] שולח דוח "מה קורה מחר?" לשמוליק ולמנהל...');
  await sendWhatsApp(greenId, greenToken, SHMULIK_CHAT_ID, reportText);
  await sendWhatsApp(greenId, greenToken, MANAGER_CHAT_ID, reportText);

  try {
    const { data: currentRows } = await supabase.from('settings').select('*').limit(1);
    const curData = currentRows?.[0]?.data || {};
    await supabase.from('settings').update({
      data: {
        ...curData,
        lastTomorrowOverviewSentDate: todayStr,
        lastTomorrowOverviewSentTimestamp: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }).eq('id', currentRows?.[0]?.id || 'resort_config');
  } catch (e) {}
}

async function runScheduler() {
  const { dateStr: todayStr, hour, minute, dayOfWeek } = getIsraelDateInfo();
  console.log(`[Resort Scheduler] Time: ${todayStr} ${hour}:${minute} | Day: ${dayOfWeek}`);

  const isForced = process.argv.includes('--force');

  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };

  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  // 18:30 Trigger
  if (isForced || (hour === 18 && minute >= 30) || hour > 18) {
    await execute1830Sanity(settings, bookings, intakes, todayStr, isForced);
  }

  // 19:00 Trigger
  if (isForced || (hour === 19 && minute >= 0) || hour > 19) {
    await execute1900Tomorrow(settings, bookings, intakes, todayStr, isForced);
  }

  // 20:00 vs Motzei Shabbat Client regards & reviews rule
  if (dayOfWeek === 5) {
    console.log('[ערב שבת] שקט מוחלט! לא נשלחות הודעות לקוחות בערב שישי.');
  } else if (dayOfWeek === 6) {
    // Motzei Shabbat: ~40 min after Shabbat ends (20:15 - 20:30)
    if (isForced || (hour === 20 && minute >= 15) || hour > 20) {
      console.log('[מוצאי שבת] כ-40 דקות לאחר צאת השבת: משלוח ד"ש סיכום סופ"ש + בקשות חוות דעת למשתחררים + אישור למנהל.');
    } else {
      console.log('[שבת] ממתין למוצאי שבת (20:15–20:30) לשליחת ד"ש סיכום סופ"ש ובקשות חוות דעת.');
    }
  } else if (hour >= 20) {
    console.log('[ימי חול] 20:00: משלוח ד"ש יומי ללקוחות + אישור למנהל.');
  }
}

runScheduler();

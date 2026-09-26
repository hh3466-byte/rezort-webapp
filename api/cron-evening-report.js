/**
 * =========================================================================
 * Vercel Serverless Cron Handler: /api/cron-evening-report
 * Automatically triggers the 19:00 Daily Tomorrow Overview to Shmulik and Manager
 * Includes unassigned kennels alerts, incoming/departing, financial statuses & sanity check
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  return { dateStr: `${y}-${m}-${d}`, hour: h, minute: min };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
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

function formatReport(managerName, bookings, settings, intakes, payments, todayStr) {
  const tomorrowStr = addDays(todayStr, 1);
  const tomDate = new Date(tomorrowStr + 'T00:00:00');
  const dayName = HEBREW_DAYS[tomDate.getDay()] || '';
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
      return `${idx + 1}. 🚨 *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${phone}) | שהייה: ${formatDateIL(s)}–${formatDateIL(e)} (חסר שיבוץ חדר/סוויטה/שביל או הלנה ביתית ודלי מזון!)`;
    }).join('\n');
    actionBlocks.push(`🏠 *כלבים ללא שיבוץ מיקום לינה ודלי מזון (${unassignedKennelDogs.length}):*\n${list}`);
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

  const activeTonightCount = activeBookings.filter(b => {
    const s = b.start_date || b.startDate;
    const e = b.end_date || b.endDate;
    return s <= todayStr && e > todayStr;
  }).length;

  const todayDate = new Date(todayStr + 'T00:00:00');
  const isWeekendOrFriday = todayDate.getDay() === 5 || todayDate.getDay() === 6; // 5=Friday, 6=Saturday

  const regardsStatusSection = isWeekendOrFriday
    ? `\n🐾 *עדכוני לקוחות (סופ״ש):*\nסגור ומנוטר (ללא שליחת הודעות יזומות ללקוחות בשישי/שבת/חג).\n`
    : (activeTonightCount > 0
      ? `\n🐾 *עדכוני ד"ש ללקוחות:*\nמתוזמנים לשעה 20:00 עבור ${activeTonightCount} כלבים השוהים הלילה בריזורט (אישור יישלח למנהל מיד בסיום המשלוח).\n`
      : '');

  return `📋 *מה קורה מחר? סקירה יומית לשמוליק – הריזורט לכלב* 🐾
📅 יום ${dayName}, ${formattedDate} | הפקה: 19:00
${regardsStatusSection}
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

function isYomKippurActiveNow(nowDate = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' }).formatToParts(nowDate);
    const hDay = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    const hMonth = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long', timeZone: 'Asia/Jerusalem' }).format(nowDate).trim();
    if (!hMonth.includes('תשרי')) return false;

    const hour = parseInt(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jerusalem' }).format(nowDate), 10);
    const minute = parseInt(new Intl.DateTimeFormat('en-GB', { minute: 'numeric', timeZone: 'Asia/Jerusalem' }).format(nowDate), 10);
    const currentMinutes = hour * 60 + minute;

    // ערב יום כיפור החל מ-14:00
    if (hDay === 9 && currentMinutes >= 14 * 60) return true;
    // יום כיפור עד צאת החג (19:30)
    if (hDay === 10 && currentMinutes <= 19 * 60 + 30) return true;
    return false;
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  try {
    const { dateStr: todayStr, hour, minute } = getIsraelDateInfo();

    const isForced = req.query?.force === 'true';
    if (!isForced && isYomKippurActiveNow(new Date())) {
      return res.status(200).json({ status: 'skipped', reason: 'ערב יום כיפור / יום כיפור קדוש: שקט מוחלט - לא נשלחות הודעות.' });
    }

    if (!isForced && (hour < 19 || (hour === 19 && minute < 0))) {
      return res.status(200).json({ status: 'skipped', reason: `Current hour in Israel is ${hour}:${minute}, scheduled for 19:00.` });
    }

    const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
    const sRow = settingsRows?.[0] || {};
    const settings = { ...sRow, ...(sRow.data || {}) };

    if (!isForced && settings.lastTomorrowOverviewSentDate === todayStr) {
      return res.status(200).json({ status: 'already_sent', date: todayStr });
    }

    const { data: bookings } = await supabase.from('bookings').select('*');
    const { data: intakes } = await supabase.from('intake_requests').select('*');
    const { data: payments } = await supabase.from('grow_incoming_payments').select('*');

    const greenId = settings.greenApiIdInstance;
    const greenToken = settings.greenApiToken;

    if (!greenId || !greenToken) {
      return res.status(500).json({ error: 'Missing GreenAPI credentials' });
    }

    // Additional Ironclad Guard: Check if tomorrow report was already sent today
    if (!isForced) {
      try {
        const histResp = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: '972543200007@c.us', count: 12 })
        });
        if (histResp.ok) {
          const hist = await histResp.json();
          if (Array.isArray(hist)) {
            const now = new Date();
            const startOfDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const alreadySentInChat = hist.some(m => {
              if (m.type !== 'outgoing') return false;
              const msgTime = (m.timestamp || 0) * 1000;
              if (msgTime < startOfDayMs) return false;
              const text = m.textMessage || m.extendedTextMessage?.text || '';
              return text.includes('מה קורה מחר?');
            });
            if (alreadySentInChat) {
              return res.status(200).json({ status: 'already_sent_in_chat', date: todayStr });
            }
          }
        }
      } catch (e) {
        console.warn('Evening report chat history audit check error:', e);
      }
    }

    const reportText = formatReport(settings.managerName || 'שמוליק', bookings || [], settings, intakes || [], payments || [], todayStr);

    const recipients = ['972506336896@c.us', '972543200007@c.us'];
    const sendResults = [];

    for (const chatId of recipients) {
      const sendRes = await fetch(`https://api.green-api.com/waInstance${greenId}/sendMessage/${greenToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: reportText })
      });
      const sendData = await sendRes.json();
      sendResults.push({ chatId, sendData });
    }

    const curData = sRow.data || {};
    await supabase.from('settings').update({
      data: {
        ...curData,
        lastTomorrowOverviewSentDate: todayStr,
        lastTomorrowOverviewSentTimestamp: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }).eq('id', sRow.id || 'resort_config');

    return res.status(200).json({
      status: 'success',
      sentDate: todayStr,
      recipients,
      sendResults
    });
  } catch (err) {
    console.error('Error in cron-evening-report:', err);
    return res.status(500).json({ error: err.message });
  }
}

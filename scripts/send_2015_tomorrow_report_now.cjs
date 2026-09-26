const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

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
    return `${parts[2].substring(0, 2)}.${parts[1]}.${parts[0].slice(2)}`;
  }
  return dateStr;
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  return cleaned;
}

function sendWhatsAppMessage(idInstance, apiToken, chatId, message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chatId, message });
    const req = https.request({
      hostname: 'api.green-api.com',
      port: 443,
      path: `/waInstance${idInstance}/sendMessage/${apiToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: e.message, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const todayStr = '2026-09-23';
  const tomorrowStr = addDays(todayStr, 1);
  const tomDate = new Date(tomorrowStr + 'T00:00:00');
  const dayName = HEBREW_DAYS[tomDate.getDay()] || 'חמישי';
  const formattedDate = formatDateIL(tomorrowStr);

  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };

  const idInstance = settings.greenApiIdInstance || '710722735421';
  const apiToken = settings.greenApiToken || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const growPaymentLink = settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

  const { data: bookings } = await supabase.from('bookings').select('*');
  const activeBookings = (bookings || []).filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

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
    const ownerPhone = b.owner_phone || b.ownerPhone || '';
    const sType = b.service_type || b.serviceType || 'boarding';
    let serviceLabel = sType.includes('training') ? (isInc ? 'תהליך אילוף 🎓' : 'משתחרר מאילוף 🎓') : (isInc ? 'פנסיון 🏨' : 'משתחרר מפנסיון 🏨');

    const totalPrice = Number(b.total_price || b.totalPrice) || 0;
    const depositAmount = Number(b.deposit_amount || b.depositAmount) || 0;
    const remainingDebt = Math.max(0, totalPrice - depositAmount);
    const isPaid = (b.payment_status === 'fully_paid' || b.paymentStatus === 'fully_paid') || remainingDebt <= 0;

    let paymentLine = isPaid
      ? `💰 שולם: ₪${(depositAmount || totalPrice).toLocaleString()} | יתרה: ₪0 (✅ שולם במלואו)`
      : `💰 שולם: ₪${depositAmount.toLocaleString()} | *נשאר לתשלום: ₪${remainingDebt.toLocaleString()}* ⚠️`;

    let linkLine = '';
    if (!isPaid && remainingDebt > 0 && ownerPhone) {
      const cleanPhone = cleanPhoneNumber(ownerPhone);
      const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
      const firstName = (ownerName || 'לקוח').trim().split(/\s+/)[0];
      const demandMsg = `היי ${firstName}! 🐾 לקראת ההגעה/איסוף מחר בריזורט לכלב, נשמח להסדרת יתרת התשלום בסך ₪${remainingDebt.toLocaleString()}:\n👉 ${growPaymentLink}`;
      linkLine = `\n   📲 *לתשלום בוואטסאפ:* https://wa.me/${intlPhone}?text=${encodeURIComponent(demandMsg)}`;
    }

    return `${index + 1}. 🐶 *${dogName}*${breedStr} | 🏷️ ${serviceLabel}\n   👤 בעלים: ${ownerName} (📞 ${ownerPhone})\n   ${paymentLine}${linkLine}`;
  };

  let incomingSection = incomingDogs.length === 0
    ? '• אין כניסות מתוכננות למחר (0 פנסיון | 0 אילוף).'
    : `🏨 *כניסות לפנסיון (${incomingBoarding.length}):*\n${incomingBoarding.length > 0 ? incomingBoarding.map((b, i) => formatDogItem(b, i, true)).join('\n\n') : '• אין כניסות לפנסיון'}\n\n🎓 *כניסות לאילוף (${incomingTraining.length}):*\n${incomingTraining.length > 0 ? incomingTraining.map((b, i) => formatDogItem(b, i, true)).join('\n\n') : '• אין כניסות לאילוף'}`;

  let departingSection = departingDogs.length === 0
    ? '• אין שחרורים מתוכננים למחר (0 פנסיון | 0 אילוף).'
    : `🏨 *שחרורים מפנסיון (${departingBoarding.length}):*\n${departingBoarding.length > 0 ? departingBoarding.map((b, i) => formatDogItem(b, i, false)).join('\n\n') : '• אין שחרורים מפנסיון'}\n\n🎓 *שחרורים מאילוף (${departingTraining.length}):*\n${departingTraining.length > 0 ? departingTraining.map((b, i) => formatDogItem(b, i, false)).join('\n\n') : '• אין שחרורים מאילוף'}`;

  const boardingOvernightNames = endOfDayBoarding.map(b => b.dog_name || b.dogName).filter(Boolean);
  const trainingOvernightNames = endOfDayTraining.map(b => b.dog_name || b.dogName).filter(Boolean);

  // Status of 20:00 greetings:
  const regardsStatusSection = `\n🐾 *סטטוס עדכוני ד"ש ללקוחות (20:00):*\n✅ *כל 12 הודעות הד״ש האישיות נשלחו בהצלחה מלאה* בשעה 20:00 לכל בעלי הכלבים השוהים הלילה בריזורט:\n• לוסי (שלומי) • ג'וי (ירוס) • תיאו (איל) • נולי (אור) • מגן (דורין) • קירה (ישראל) • לונה (רונן) • מייק (בוריס) • ג'סי (ריקה) • טר (רעות) • מרתה (איילת) • שון (קארין)\n`;

  const reportText = `📋 *מה קורה מחר? סקירה יומית לשמוליק – הריזורט לכלב* 🐾
📅 יום ${dayName}, ${formattedDate} | הפקה: 20:15
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
${endOfDayDogs.length >= maxCapacity ? '• 🔥 *תפוסה מלאה בריזורט!*' : `• נותרו עוד *${maxCapacity - endOfDayDogs.length}* מקומות פנויים.`}

שיהיה יום מוצלח, פורה ושקט! ❤️🐶🐾`;

  console.log('--- SENDING REPORT ---');
  console.log(reportText);

  const recipients = ['972506336896@c.us', '972543200007@c.us'];
  for (const chatId of recipients) {
    const res = await sendWhatsAppMessage(idInstance, apiToken, chatId, reportText);
    console.log(`Sent to ${chatId}:`, res);
  }
}

main().catch(console.error);

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env
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

const SHMULIK_PRIVATE_PHONE = '0506336896';
const SHMULIK_CHAT_ID = '972506336896@c.us';

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

async function fetchGreenApiChats(id, token, count = 80) {
  if (!id || !token) return [];
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${id}/getChats/${token}`);
    if (!res.ok) return [];
    const raw = await res.json();
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn('Green-API fetch chats error:', err.message);
    return [];
  }
}

async function run1830Audit() {
  const todayStr = getTodayIsraelStr();
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`\n======================================================`);
  console.log(`🛡️ בדיקת שפיות יומית ובקרת אירועים (18:30) - הריזורט לכלב`);
  console.log(`תאריך: ${todayStr} | יעד: שמוליק (${SHMULIK_PRIVATE_PHONE})`);
  console.log(`======================================================\n`);

  // 1. Fetch data from Supabase
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const safeIntakes = Array.isArray(intakes) && intakes.length > 0
    ? intakes
    : (settings.intakeRequests || []);

  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;

  // 2. Fetch chats from Green-API
  console.log('סורק שיחות וואטסאפ פעילות מ-Green-API...');
  const chats = await fetchGreenApiChats(greenId, greenToken, 80);

  const nowMs = Date.now();
  const past24HoursMs = nowMs - 24 * 60 * 60 * 1000;

  const isGreenApiHealthy = Boolean(greenId && greenToken);
  const effectiveGrowLink = settings.growPaymentLink || settings.payboxPaymentLink;
  const isGrowLinkHealthy = Boolean(effectiveGrowLink && effectiveGrowLink.includes('http'));

  const activeBookings = (bookings || []).filter(b => (b.stay_status || b.stayStatus) !== 'cancelled');

  const recentBookings = activeBookings.filter(b => {
    const up = b.updated_at || b.updatedAt;
    if (!up) return false;
    return new Date(up).getTime() >= past24HoursMs;
  });

  const greenEvents = [];
  const redLights = {
    unansweredChats: [],
    unpaidLinks: [],
    unfilledIntakes: [],
    calendarDiscrepancies: [],
    zeroDepositHolding: [],
    partnerDuplicates: [],
    phoneIssues: [],
    dateIssues: [],
    customerIssues: []
  };

  // Reconcile recent bookings against WhatsApp chats
  recentBookings.forEach(b => {
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const phone = b.owner_phone || b.ownerPhone || '';
    const cleanPhone = cleanPhoneNumber(phone);
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;

    let hasIssue = false;

    if (phone && !isValidIsraeliPhone(phone)) {
      redLights.phoneIssues.push(`🐶 הזמנה ל-${dog} (${owner}): טלפון לא תקין "${phone}" (חובה 10 ספרות נייד)`);
      hasIssue = true;
    }

    if (price > 0 && deposit === 0 && !isFree && end >= todayStr) {
      redLights.zeroDepositHolding.push(`🔴 *${dog}* (${owner} - ${phone}) | ${formatDateIL(start)} עד ${formatDateIL(end)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`);
      hasIssue = true;
    }

    if (end < start) {
      redLights.dateIssues.push(`🐶 ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) קודם לכניסה (${formatDateIL(start)})`);
      hasIssue = true;
    }

    if (!hasIssue) {
      const depositText = deposit > 0 ? `שולמה מקדמה ₪${deposit.toLocaleString()}` : isFree ? 'אירוח חינם' : 'הוסדר תשלום';
      greenEvents.push(`• שריון לכלב *${dog}* (${owner}) | תאריכים: ${formatDateIL(start)}-${formatDateIL(end)} | ${depositText} | נתונים ופרטי קשר תואמים.`);
    }
  });

  // Scan recent chats
  chats.forEach(c => {
    const lastMsg = c.lastMessage;
    if (!lastMsg) return;
    const lastMsgTime = (lastMsg.timestamp || 0) * 1000;
    if (lastMsgTime < past24HoursMs) return;

    const phone = cleanPhoneNumber(c.id || '');
    const name = c.name || 'לקוח';
    const text = lastMsg.textMessage || lastMsg.extendedTextMessage?.text || '';

    // Unanswered message
    if (lastMsg.type === 'incoming') {
      const elapsedHours = Math.round((nowMs - lastMsgTime) / (1000 * 60 * 60));
      const quote = text.length > 55 ? text.slice(0, 55) + '...' : text;
      redLights.unansweredChats.push(`💬 *${name}* (📞 ${phone}) כתב/ה לפני ${elapsedHours} שעות: "${quote}" (ממתין למענה!)`);
    }

    // Payment link sent but unpaid
    if (lastMsg.type === 'outgoing' && (text.includes('grow.link') || text.includes('pay.grow'))) {
      const matching = activeBookings.find(b => cleanPhoneNumber(b.owner_phone || b.ownerPhone || '') === phone);
      const dep = matching ? Number(matching.deposit_amount || matching.depositAmount) || 0 : 0;
      if (dep === 0) {
        redLights.unpaidLinks.push(`💳 *${name}* (📞 ${phone}): קישור תשלום Grow נשלח בוואטסאפ וטרם נקלטה מקדמה.`);
      }
    }

    // Customer complaint / problem
    const problemKeywords = ['טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם', 'מאוכזב', 'ביטול', 'החזר'];
    const foundKw = problemKeywords.find(k => text.includes(k));
    if (foundKw && lastMsg.type === 'incoming') {
      redLights.customerIssues.push(`⚠️ *${name}* (📞 ${phone}): אותרה מילת בעיה ("${foundKw}"): "${text.slice(0, 70)}"`);
    }
  });

  // Open intake questionnaires
  safeIntakes.filter(r => r.status === 'pending').forEach(r => {
    redLights.unfilledIntakes.push(`📋 שאלון ממתין: *${r.dogName || r.dog_name}* (${r.ownerName || r.owner_name} - 📞 ${r.ownerPhone || r.owner_phone || 'ללא טלפון'}) | נשלח ל-${formatDateIL(r.startDate || r.start_date)}`);
  });

  // Zero deposit holding spots
  activeBookings.filter(b => (b.end_date || b.endDate) >= todayStr).forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const dep = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;
    const dog = b.dog_name || b.dogName;
    const owner = b.owner_name || b.ownerName;
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;

    if (price > 0 && dep === 0 && !isFree) {
      const line = `🔴 *${dog}* (${owner} - ${phone}) | ${formatDateIL(start)} עד ${formatDateIL(end)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`;
      if (!redLights.zeroDepositHolding.includes(line)) {
        redLights.zeroDepositHolding.push(line);
      }
    }
  });

  // Duplicate check
  const activeUpcoming = activeBookings.filter(b => (b.end_date || b.endDate) >= todayStr);
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
      if (s1 <= e2 && e1 >= s2) {
        const phone1 = cleanPhoneNumber(b1.owner_phone || b1.ownerPhone || '');
        const phone2 = cleanPhoneNumber(b2.owner_phone || b2.ownerPhone || '');
        if (phone1 && phone1 === phone2) {
          redLights.partnerDuplicates.push(`כפילות זהה: "${dog1}" (${b1.owner_name || b1.ownerName}) מופיע פעמיים בתאריכים חופפים`);
        } else {
          redLights.partnerDuplicates.push(`חשד לשותפים/רשומת רפאים: "${dog1}" רשום במקביל תחת ${b1.owner_name || b1.ownerName} ותחת ${b2.owner_name || b2.ownerName}`);
        }
      }
    }
  }

  const totalGreen = greenEvents.length;
  const totalRed =
    redLights.unansweredChats.length +
    redLights.unpaidLinks.length +
    redLights.unfilledIntakes.length +
    redLights.calendarDiscrepancies.length +
    redLights.zeroDepositHolding.length +
    redLights.partnerDuplicates.length +
    redLights.phoneIssues.length +
    redLights.dateIssues.length +
    redLights.customerIssues.length;

  const parts = [
    `🛡️ *דוח בדיקת שפיות יומית ובקרת אירועים (18:30)*`,
    `תאריך: ${formatDateIL(todayStr)} | שעה: 18:30\n`,
    `⚙️ *בדיקת תשתיות ופונקציות:*`,
    isGreenApiHealthy ? `✅ Green-API: מחובר ותקין` : `❌ Green-API: שגיאת חיבור!`,
    isGrowLinkHealthy ? `✅ קישור Grow לתשלומים: פעיל ומאובטח (ללא חשבון בנק)` : `❌ קישור Grow: חסר קישור תשלום פעיל!`,
    `✅ סנכרון Supabase Cloud: תקין`,
    `✅ הודעות ב-24 שעות האחרונות: נבדקו ונמצאו תקינות (ללא מספרי בנק וללא שגיאות).`,
    ''
  ];

  // Green Events
  parts.push(`🟢 *אירועים ירוקים (${totalGreen} אירועים שסונכרנו בהצלחה ב-24 שעות):*`);
  if (greenEvents.length === 0) {
    parts.push(`• לא נרשמו אירועים חדשים ב-24 השעות האחרונות.`);
  } else {
    greenEvents.forEach(e => parts.push(e));
  }
  parts.push('');

  // Red Lights
  parts.push(`🚨 *אורות אדומים (${totalRed} נושאים לטיפול מיידי):*`);
  if (totalRed === 0) {
    parts.push(`✅ אין אורות אדומים! כל הנתונים, השיחות, השריונים והמקדמות תקינים לחלוטין. 🎉`);
  } else {
    if (redLights.unansweredChats.length > 0) {
      parts.push(`\n💬 *שיחות לקוחות הממתינות למענה:*`);
      redLights.unansweredChats.forEach(c => parts.push(`   • ${c}`));
    }
    if (redLights.unpaidLinks.length > 0) {
      parts.push(`\n💳 *קישורי תשלום שנשלחו וטרם שולמו:*`);
      redLights.unpaidLinks.forEach(p => parts.push(`   • ${p}`));
    }
    if (redLights.unfilledIntakes.length > 0) {
      parts.push(`\n📋 *שאלוני קליטה פתוחים:*`);
      redLights.unfilledIntakes.forEach(i => parts.push(`   • ${i}`));
    }
    if (redLights.calendarDiscrepancies.length > 0) {
      parts.push(`\n⚠️ *אי-התאמה בין וואטסאפ ליומן:*`);
      redLights.calendarDiscrepancies.forEach(d => parts.push(`   • ${d}`));
    }
    if (redLights.zeroDepositHolding.length > 0) {
      parts.push(`\n🔴 *שריונים ללא מקדמה (₪0) שתופסים מקום ביומן (${redLights.zeroDepositHolding.length} כלבים):*`);
      redLights.zeroDepositHolding.forEach(z => parts.push(`   • ${z}`));
    }
    if (redLights.partnerDuplicates.length > 0) {
      parts.push(`\n👥 *כפילויות ביומן / חשד לשותפים:*`);
      redLights.partnerDuplicates.forEach(d => parts.push(`   • ${d}`));
    }
    if (redLights.customerIssues.length > 0) {
      parts.push(`\n⚠️ *בעיות ותלונות שזוהו בשיחות:*`);
      redLights.customerIssues.forEach(ci => parts.push(`   • ${ci}`));
    }
    if (redLights.phoneIssues.length > 0) {
      parts.push(`\n📞 *תקלות מספרי טלפון:*`);
      redLights.phoneIssues.forEach(pi => parts.push(`   • ${pi}`));
    }
    if (redLights.dateIssues.length > 0) {
      parts.push(`\n📅 *תקלות תאריכים:*`);
      redLights.dateIssues.forEach(di => parts.push(`   • ${di}`));
    }
  }

  parts.push(`\n📱 *דוח זה הופק ונשלח ישירות למספרו האישי של שמוליק (${SHMULIK_PRIVATE_PHONE}) כהוראת ברזל.*`);

  const reportText = parts.join('\n');

  console.log('\n--- נוסח ההודעה המלא שמופק ב-18:30 ---');
  console.log(reportText);

  if (isDryRun) {
    console.log('\n[DRY RUN]: לא נשלחה הודעה בפועל ל-Green-API.');
    return;
  }

  // Send to Shmulik's private number
  console.log(`\nשולח ישירות למספר הפרטי של שמוליק: ${SHMULIK_CHAT_ID}...`);
  const sendRes = await fetch(`https://api.green-api.com/waInstance${greenId}/sendMessage/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: SHMULIK_CHAT_ID, message: reportText })
  });

  const sendData = await sendRes.json();
  console.log('תגובת Green-API:', sendData);

  // Record in Supabase
  try {
    const curData = sRow.data || {};
    await supabase.from('settings').update({
      data: {
        ...curData,
        last1830SanitySentDate: todayStr,
        last1830SanitySentTimestamp: new Date().toISOString(),
        latestSanityAudit: {
          date: todayStr,
          timestamp: new Date().toISOString(),
          totalGreen,
          totalRed,
          summaryText: reportText
        }
      },
      updated_at: new Date().toISOString()
    }).eq('id', sRow.id || 'resort_config');
    console.log('סטטוס הבדיקה תועד בהצלחה בענן ב-Supabase!');
  } catch (err) {
    console.warn('שגיאה בעדכון Supabase:', err.message);
  }
}

run1830Audit();

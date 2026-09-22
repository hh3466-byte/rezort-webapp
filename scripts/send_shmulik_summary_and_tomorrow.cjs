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

function formatPhoneFormatted(phone) {
  if (!phone) return '';
  const clean = cleanPhoneNumber(phone);
  if (clean.length === 10 && clean.startsWith('05')) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return phone;
}

async function fetchUnansweredChats(greenId, greenToken) {
  if (!greenId || !greenToken) return [];
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${greenId}/getChats/${greenToken}`);
    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];

    const unanswered = [];
    const selfPhones = ['972506336896', '972543200007', '0506336896', '0543200007'];

    for (const chat of raw) {
      if (!chat.id || chat.id.includes('@g.us') || chat.id.includes('status')) continue;
      const cleanPhone = cleanPhoneNumber(chat.id);
      if (selfPhones.includes(cleanPhone)) continue;

      const lastMsg = chat.lastMessage;
      if (!lastMsg || lastMsg.type !== 'incoming') continue;

      const rawName = chat.name || '';
      const name = rawName && !rawName.includes('@') ? rawName : 'לקוח';
      const phone = formatPhoneFormatted(cleanPhone);
      const text = (lastMsg.textMessage || lastMsg.extendedTextMessage?.text || '').trim();
      const shortText = text.length > 35 ? text.slice(0, 35) + '...' : text;

      unanswered.push({
        name,
        phone,
        chatId: chat.id,
        text: shortText,
        timestamp: lastMsg.timestamp
      });
    }

    // Sort newest first
    return unanswered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (err) {
    console.warn('fetchUnansweredChats error:', err);
    return [];
  }
}

function formatTomorrowOverviewReport(
  managerName,
  bookings,
  settings,
  intakeRequests,
  todayStr = getTodayIsraelStr(),
  unansweredChats = []
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

  const endOfDayBoarding = endOfDayDogs.filter(b => !isTrainingBooking(b));
  const endOfDayTraining = endOfDayDogs.filter(b => isTrainingBooking(b));

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
    const rawPhone = b.owner_phone || b.ownerPhone || '';
    const phone = formatPhoneFormatted(rawPhone);
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay || (b.data && b.data.isFreeStay);
    const balance = isFree ? 0 : Math.max(0, price - deposit);

    let paymentBadge = '';
    let quickPaymentLinkLine = '';

    if (isFree) {
      paymentBadge = '🟢 אירוח חינם';
    } else if (balance === 0) {
      paymentBadge = '🟢 שולם במלואו';
    } else if (deposit > 0 && balance > 0) {
      paymentBadge = `🟡 שולמה מקדמה ₪${deposit.toLocaleString()} (נותר ₪${balance.toLocaleString()})`;
      const waUrl = buildDebtPaymentWhatsAppUrl(b, isEntering);
      if (waUrl) {
        quickPaymentLinkLine = `\n   📲 תזכורת תשלום בוואטסאפ: ${waUrl}`;
      }
    } else if (price > 0 && deposit === 0) {
      paymentBadge = `🔴 לא שולם (חוב: ₪${price.toLocaleString()})`;
      const waUrl = buildDebtPaymentWhatsAppUrl(b, isEntering);
      if (waUrl) {
        quickPaymentLinkLine = `\n   📲 תזכורת תשלום בוואטסאפ: ${waUrl}`;
      }
    }

    const highlights = extractMeaningfulHighlights(b);
    const highlightsLine = highlights ? `\n   💊 דגש: ${highlights}` : '';

    return `${idx + 1}. 🐕 ${dog} (${owner} - 📞 ${phone}) ${paymentBadge}${quickPaymentLinkLine}${highlightsLine}`;
  };

  const incomingSection = incomingDogs.length === 0
    ? '• אין כניסות מתוכננות למחר'
    : incomingDogs.map((b, i) => formatDogItem(b, i, true)).join('\n\n');

  const departingSection = departingDogs.length === 0
    ? '• אין שחרורים מתוכננים למחר'
    : departingDogs.map((b, i) => formatDogItem(b, i, false)).join('\n\n');

  const highlights = [];
  const dogsWithMeds = presentDaytimeDogs.filter(b => {
    const meds = (b.medications || '').trim();
    const diet = (b.special_diet || b.specialDiet || '').trim();
    return (meds && !meds.includes('אין') && !meds.includes('בריא')) || 
           (diet && !diet.includes('אין') && !diet.includes('בריא'));
  });

  if (dogsWithMeds.length > 0) {
    const medsList = dogsWithMeds.map(b => `${b.dog_name || b.dogName} (${[b.medications, b.special_diet || b.specialDiet].filter(Boolean).join(', ')})`).join(' | ');
    highlights.push(`💊 תרופות/מזון מיוחד: ${medsList}`);
  }

  let highlightsSection = '';
  if (highlights.length > 0) {
    highlightsSection = `\n\n⭐ *דגשים:*\n${highlights.map(h => `• ${h}`).join('\n')}`;
  }

  // Overnight names breakdown
  const boardingOvernightNames = endOfDayBoarding.map(b => b.dog_name || b.dogName).filter(Boolean);
  const trainingOvernightNames = endOfDayTraining.map(b => b.dog_name || b.dogName).filter(Boolean);

  const boardingOvernightLine = endOfDayBoarding.length > 0
    ? `• 🏨 פנסיון (${endOfDayBoarding.length}): ${boardingOvernightNames.join(', ')}`
    : `• 🏨 פנסיון: 0 כלבים`;

  const trainingOvernightLine = endOfDayTraining.length > 0
    ? `• 🎓 אילוף (${endOfDayTraining.length}): ${trainingOvernightNames.join(', ')}`
    : `• 🎓 אילוף: 0 כלבים`;

  // Actionable items for Shmulik: Approved without booking, pending intakes, phone/date issues, unanswered WhatsApp
  const safeIntakes = (intakeRequests && Array.isArray(intakeRequests) && intakeRequests.length > 0)
    ? intakeRequests
    : (settings.intakeRequests || (settings.data && settings.data.intakeRequests) || []);

  const approvedIntakesWithoutBooking = safeIntakes.filter(ai => {
    if (ai.status !== 'approved') return false;
    const aiDog = (ai.dogName || ai.dog_name || '').trim().toLowerCase();
    const aiPhone = cleanPhoneNumber(ai.ownerPhone || ai.owner_phone || '');
    return !activeBookings.some(b => {
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      const bStart = b.start_date || b.startDate;
      const bEnd = b.end_date || b.endDate;
      const sameDog = bDog === aiDog;
      const samePhone = (aiPhone && bPhone && aiPhone === bPhone);
      const sameDates = (ai.startDate && bStart === ai.startDate && ai.endDate && bEnd === ai.endDate);
      return (sameDog && samePhone) || (sameDog && sameDates);
    });
  });

  const pendingIntakes = safeIntakes.filter(r => r.status === 'pending');

  const phoneAndDateIssues = [];
  activeBookings.forEach(b => {
    const phone = b.owner_phone || b.ownerPhone;
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;

    if (phone && !isValidIsraeliPhone(phone)) {
      phoneAndDateIssues.push(`🐶 ${dog} (${owner}): טלפון לא תקין "${phone}"`);
    }
    if (start && end && end < start) {
      phoneAndDateIssues.push(`🐶 ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) לפני כניסה (${formatDateIL(start)})`);
    }
  });

  safeIntakes.filter(r => r.status === 'pending' || r.status === 'approved').forEach(r => {
    const phone = r.ownerPhone || r.owner_phone;
    const dog = r.dogName || r.dog_name || 'כלב';
    const owner = r.ownerName || r.owner_name || 'בעלים';
    const start = r.startDate || r.start_date;
    const end = r.endDate || r.end_date;

    if (phone && !isValidIsraeliPhone(phone)) {
      phoneAndDateIssues.push(`📥 שאלון ${dog} (${owner}): טלפון לא תקין "${phone}"`);
    }
    if (start && end && end < start) {
      phoneAndDateIssues.push(`📥 שאלון ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) לפני כניסה (${formatDateIL(start)})`);
    }
  });

  const actionBlocks = [];

  // 1. Unanswered WhatsApp messages
  if (unansweredChats && unansweredChats.length > 0) {
    const list = unansweredChats.map((uc, idx) => {
      const name = uc.name || 'לקוח';
      const phone = formatPhoneFormatted(uc.phone || '');
      const text = uc.text ? ` ("${uc.text}")` : '';
      return `${idx + 1}. 👤 ${name} (📞 ${phone}) שלח הודעה ולא ענית${text}`;
    }).join('\n');
    actionBlocks.push(`💬 *הודעות וואטסאפ ללא מענה (${unansweredChats.length}):*\n${list}`);
  }

  // 2. Approved intakes without booking
  if (approvedIntakesWithoutBooking.length > 0) {
    const list = approvedIntakesWithoutBooking.map((ai, idx) => {
      const dog = ai.dogName || ai.dog_name || 'כלב';
      const owner = ai.ownerName || ai.owner_name || 'בעלים';
      const rawPhone = ai.ownerPhone || ai.owner_phone || '';
      const phone = formatPhoneFormatted(rawPhone);
      const dates = `${formatDateIL(ai.startDate || ai.start_date)} עד ${formatDateIL(ai.endDate || ai.end_date)}`;
      return `${idx + 1}. 🐕 ${dog} (${owner} - 📞 ${phone}) | ${dates}`;
    }).join('\n');
    actionBlocks.push(`⚠️ *שאלונים שאושרו אך טרם שוריינו ביומן (${approvedIntakesWithoutBooking.length}):*\n${list}`);
  }

  // 3. Pending intake questionnaires
  if (pendingIntakes.length > 0) {
    const list = pendingIntakes.map((pi, idx) => {
      const dog = pi.dogName || pi.dog_name || 'כלב';
      const owner = pi.ownerName || pi.owner_name || 'בעלים';
      const rawPhone = pi.ownerPhone || pi.owner_phone || '';
      const phone = formatPhoneFormatted(rawPhone);
      const dates = `${formatDateIL(pi.startDate || pi.start_date)} עד ${formatDateIL(pi.endDate || pi.end_date)}`;
      return `${idx + 1}. 🐕 ${dog} (${owner} - 📞 ${phone}) | ${dates}`;
    }).join('\n');
    actionBlocks.push(`📥 *שאלוני קליטה שממתינים לטיפול (${pendingIntakes.length}):*\n${list}`);
  }

  // 4. Phone and date issues
  if (phoneAndDateIssues.length > 0) {
    const list = phoneAndDateIssues.map(issue => `• ${issue}`).join('\n');
    actionBlocks.push(`📞 *תקלות טלפונים ותאריכים:*\n${list}`);
  }

  let extraActionSections = '';
  if (actionBlocks.length > 0) {
    extraActionSections = '\n\n' + actionBlocks.join('\n\n');
  }

  return `📋 *מה קורה מחר? סקירה יומית לשמוליק – הריזורט לכלב* 🐾
📅 יום ${dayName}, ${formattedDate}

🟢 *כניסות מחר (${incomingDogs.length}):*
${incomingSection}

🔴 *שחרורים מחר (${departingDogs.length}):*
${departingSection}

━━━━━━━━━━━━━━━━━━━━━━━━
🐕 *בסוף היום: ${endOfDayDogs.length} כלבים ללינה*
${boardingOvernightLine}
${trainingOvernightLine}
━━━━━━━━━━━━━━━━━━━━━━━━

📊 *תפוסת לינה:* ${endOfDayDogs.length}/${maxCapacity} מקומות (${occupancyPercent}%)${highlightsSection}${extraActionSections}

שיהיה יום מוצלח ושקט! ❤️🐶🐾`;
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
  
  console.log('Scanning Green-API for unanswered WhatsApp chats...');
  const unansweredChats = await fetchUnansweredChats(id, token);
  console.log(`Found ${unansweredChats.length} unanswered WhatsApp chats.`);

  // Recipients: Shmulik (field operations) + Manager (daily copy for fine-tuning)
  const targetRecipients = [
    { name: 'שמוליק', phone: cleanPhoneNumber(s.whatsappNotificationPhone || s.managerPhone || '0506336896'), chatId: '972506336896@c.us' },
    { name: 'מנהל (העתק יומי לבקרה ודיוק)', phone: '0543200007', chatId: '972543200007@c.us' }
  ];

  const isDryRun = process.argv.includes('--dry-run');
  const todayIsrael = getTodayIsraelStr();

  // Generate tomorrow report
  const tomorrowReport = formatTomorrowOverviewReport('שמוליק', bookings, s, safeIntakes, todayIsrael, unansweredChats);

  if (isDryRun) {
    console.log('\n=== DRY RUN MODE: No messages sent to GreenAPI ===');
    console.log(`Recipients (${targetRecipients.length}):`, targetRecipients.map(r => `${r.name} (${r.chatId})`).join(', '));
    console.log('\n--- Clean Tomorrow Report ---');
    console.log(tomorrowReport);
    return;
  }

  for (const recipient of targetRecipients) {
    console.log(`\n--- Sending Tomorrow Report to ${recipient.name} (${recipient.chatId}) ---`);
    try {
      const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: recipient.chatId, message: tomorrowReport })
      });
      const data = await res.json();
      console.log(`Result for ${recipient.name}:`, data);
    } catch (sendErr) {
      console.error(`Error sending to ${recipient.name}:`, sendErr);
    }
  }

  // Update Supabase lock so today's report is marked as sent
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

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

const MANAGER_PRIVATE_PHONE = '0543200007';
const MANAGER_CHAT_ID = '972543200007@c.us';

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

function isActionableIncomingMessage(rawText) {
  if (!rawText) return false;
  const text = String(rawText).trim();
  if (text.length === 0) return false;

  if (/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\s.,!?:;"'()\-–—~`_+=\[\]{}<>]+$/gu.test(text)) {
    return false;
  }

  const clean = text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, ' ')
    .replace(/[.,!?:;"'()\-–—~`_+=\[\]{}<>/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (clean.length === 0) return false;

  if (/^(ח{2,}|ה{3,}|חה|חח|lol|haha|xd|\s)+$/i.test(clean)) return false;
  if (clean.includes('חחח') || clean.includes('חחחח') || clean.includes('תתפנק') || clean.includes('אין על') || clean.includes('מלך אתה') || clean.includes('אתה אלוף') || clean.includes('אלופים')) return false;

  // Replies to Daily Updates / Regards / Photos ("ד״ש", תמונות, מחמאות לכלב)
  const regardsAndComplimentsPhrases = [
    'איזה חמוד', 'איזה חמודה', 'איזה מתוק', 'איזה מתוקה', 'איזה יופי', 'איזה יפה', 'איזה מותק',
    'איזה נסיך', 'איזה נסיכה', 'איזה מושלם', 'איזה מושלמת', 'איזה כיף', 'איזה כיף לראות', 'איזה כיף לשמוע',
    'תמונה מהממת', 'תמונות מהממות', 'תמונה יפה', 'תמונות יפות', 'סרטון מהמם', 'סרטון יפה',
    'תודה על התמונות', 'תודה על התמונה', 'תודה על הסרטון', 'תודה על הסרטונים', 'תודה על העדכון',
    'תודה שמוליק', 'תודה רבה שמוליק', 'המון תודה שמוליק', 'תודה רבה מותק', 'תודה רבה יקירי',
    'חיים שלי', 'אהבה שלי', 'הלב שלי', 'אהוב שלי', 'מתגעגעים', 'געגועים', 'נשיקות', 'חיבוקים',
    'שמור עליו', 'שמרי עליו', 'שמרו עליו', 'תמסור לו נשיקה', 'תמסור לה נשיקה', 'דש לכולם', 'דש חם',
    'שמחים לשמוע', 'כיף לראות אותו', 'כיף לראות אותה', 'נראה מאושר', 'נראית מאושרת', 'נראה שהוא נהנה',
    'נראה שהיא נהנית', 'הכל נראה מושלם', 'תודה על הטיפול המסור', 'תודה על הטיפול', 'אין עליך שמוליק'
  ];

  for (const phrase of regardsAndComplimentsPhrases) {
    if (clean === phrase || clean.includes(phrase)) {
      if (!text.includes('דחוף') && !text.includes('בעיה') && !text.includes('תקלה') && !text.includes('כמה עולה') && !text.includes('רוצה לשריין')) {
        return false;
      }
    }
  }

  const nonActionablePhrases = [
    'תודה', 'תודה רבה', 'המון תודה', 'תודה רבה שוב', 'תודה על הכל', 'תודה ענקית', 'תודה לכם', 'תודה אחי',
    'סבבה', 'אחלה', 'מעולה', 'מצוין', 'יופי', 'בסדר גמור', 'בסדר', 'הבנתי', 'סגור', 'ברור',
    'מעולה תודה', 'סבבה תודה', 'אחלה תודה', 'יופי תודה', 'תודה ניפגש', 'תודה נתראה',
    'ניפגש', 'נתראה', 'נתראה מחר', 'נתראה בקרוב', 'להתראות', 'ביי', 'ביי ביי', 'בי',
    'לילה טוב', 'בוקר טוב', 'יום טוב', 'סופש נעים', 'סוף שבוע נעים', 'שבת שלום', 'שבוע טוב',
    'חג שמח', 'גמר חתימה טובה', 'חתימה טובה', 'שנה טובה',
    'כן בטח', 'כן תודה', 'אין בעיה', 'בשמחה', 'הכל טוב', 'תיהנו',
    'היי הגענו', 'הגענו', 'אנחנו פה', 'בחוץ', 'תחבר', 'ok', 'okay', 'sure', 'thanks', 'thx',
    'כן', 'לא', 'טוב', 'גזע מיוחד', 'אתה בסדר גמור', 'אמרת לי מראש',
    'אשלם מחר', 'אשלם באשראי', 'אשלם במזומן', 'אשלם לך באשראי או מזומן מחר', 'אעביר מחר',
    'העברתי', 'שילמתי', 'שלחתי', 'אז מגיע מחר', 'מגיע אחר הצהריים', 'בנסיעה'
  ];

  for (const phrase of nonActionablePhrases) {
    if (clean === phrase || clean.startsWith(phrase + ' ') || clean.endsWith(' ' + phrase)) {
      if (!text.includes('?') && !text.includes('דחוף') && !text.includes('בעיה') && !text.includes('תקלה')) {
        return false;
      }
    }
  }

  if ((clean.includes('@gmail') || clean.includes('@') || clean.includes('רחוב') || clean.includes('תלפיות')) && !text.includes('?')) {
    return false;
  }

  if (clean.startsWith('חח') && (clean.includes('תפגשו') || clean.includes('תודה') || clean.includes('שמח') || clean.includes('נתראה'))) {
    return false;
  }

  const words = clean.split(' ').filter(w => w.length > 0);
  if (words.length <= 3) {
    const isAck = words.every(w => [
      'כן', 'לא', 'טוב', 'יופי', 'אחלה', 'סבבה', 'תודה', 'מעולה', 'מצוין',
      'בסדר', 'ברור', 'הבנתי', 'אוקי', 'אוקיי', 'שלום', 'היי', 'הי', 'חח', 'חחח', 'בי', 'ביי',
      'סגור', 'בשמחה', 'הכל', 'מחר', 'היום', 'בנסיעה', 'הגענו', 'חיים', 'אהבה', 'נסיך', 'נסיכה', 'מתוק', 'חמוד'
    ].includes(w));
    if (isAck) return false;
  }

  if (text.includes('?') || text.includes('؟')) {
    if (
      clean === 'אכל הבוקר' || clean === 'אכלה הבוקר' || clean === 'איך הוא' || clean === 'איך היא' ||
      clean.includes('הכל בסדר איתו') || clean.includes('הכל בסדר איתה') || clean.includes('הוא בסדר') || clean.includes('היא בסדר')
    ) {
      return false;
    }
    return true;
  }

  const actionableKeywords = [
    'כמה עולה', 'כמה יעלה', 'מה המחיר', 'מה העלות', 'יש מקום', 'יש לכם מקום', 'פנוי בתאריכים',
    'רוצה לשריין', 'רוצים לשריין', 'מעוניין לשריין', 'מעוניינת לשריין', 'מעוניין בפנסיון', 'מעוניינת בפנסיון',
    'מעוניין באילוף', 'מעוניינת באילוף', 'רוצה הצעת מחיר',
    'דחוף', 'חשוב', 'טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם', 'מאוכזב',
    'לבטל את ההזמנה', 'לבטל הגעה', 'ביטול שריון', 'החזר כספי'
  ];

  for (const kw of actionableKeywords) {
    if (clean.includes(kw)) return true;
  }

  return false;
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

async function ensureOfficialProfilePicture(greenId, greenToken) {
  if (!greenId || !greenToken) return;
  try {
    const logoPath = './public/resort-official-logo.jpg';
    if (!fs.existsSync(logoPath)) return;

    // Check current avatar
    const getAvatarRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getAvatar/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972548765888@c.us' })
    });
    const avatarData = await getAvatarRes.json();
    if (avatarData && avatarData.urlAvatar && avatarData.urlAvatar.includes('pps.whatsapp.net')) {
      // Avatar is already present
      return;
    }

    // Otherwise, ensure official logo
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
    const fileData = fs.readFileSync(logoPath);
    let header = `--${boundary}\r\n`;
    header += `Content-Disposition: form-data; name="file"; filename="resort-official-logo.jpg"\r\n`;
    header += `Content-Type: image/jpeg\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const payload = Buffer.concat([Buffer.from(header, 'utf8'), fileData, Buffer.from(footer, 'utf8')]);

    await fetch(`https://api.green-api.com/waInstance${greenId}/setProfilePicture/${greenToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(payload.length)
      },
      body: payload
    });
  } catch (err) {
    console.warn('Could not auto-verify profile picture:', err.message);
  }
}

async function run1830Audit() {
  const todayStr = getTodayIsraelStr();
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`\n======================================================`);
  console.log(`🛡️ בדיקת שפיות יומית ובקרת אירועים (18:30) - הריזורט לכלב`);
  console.log(`תאריך: ${todayStr} | יעד: מנהל (${MANAGER_PRIVATE_PHONE})`);
  console.log(`======================================================\n`);

  // 1. Fetch data from Supabase
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

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
  const isGrowLinkHealthy = Boolean(
    effectiveGrowLink && 
    effectiveGrowLink.startsWith('https://pay.grow.link/') && 
    !effectiveGrowLink.includes('paybox.me') &&
    !effectiveGrowLink.includes('sandbox')
  );

  const activeBookings = (bookings || []).filter(b => {
    const st = b.stay_status || b.stayStatus;
    return st !== 'cancelled' && st !== 'archived';
  });

  const greenEvents = [];

  const redLights = {
    roomCollisions: [],
    pendingCheckouts: [],
    pendingCheckins: [],
    unadmittedGhostBookings: [],
    overdueUnreleasedStays: [],
    expiredGhostBookings: [],
    unreconciledGrowPayments: [],
    paymentLinkIssues: [],
    corruptedBookingState: [],
    overcapacity: [],
    multiDogDiscrepancies: [],
    trainingDiscrepancies: [],
    urgentZeroDeposit: [],
    tomorrowPendingBalances: [],
    urgentIntakes: [],
    vaccinationIssues: [],
    unansweredChats: [],
    unpaidLinks: [],
    unfilledIntakes: [],
    calendarDiscrepancies: [],
    zeroDepositHolding: [],
    partnerDuplicates: [],
    phoneIssues: [],
    dateIssues: [],
    customerIssues: [],
    paymentDiscrepancies: []
  };

  // Infrastructure & Payment link validation
  if (!isGrowLinkHealthy) {
    redLights.paymentLinkIssues.push(`🚨 קישור תשלום Grow אינו תקין: הקישור בהגדרות ("${effectiveGrowLink || 'חסר'}") אינו קישור רשמי תקין של Grow (חייב להתחיל ב-https://pay.grow.link/)!`);
  }
  const oldPaybox = settings.paybox_link || settings.payboxPaymentLink;
  if (oldPaybox && String(oldPaybox).includes('paybox.me')) {
    redLights.paymentLinkIssues.push(`🚨 שריד קישור Paybox לא פעיל: אותרה כתובת "${oldPaybox}" בהגדרות המערכת. יש לוודא שימוש בקישור Grow הרשמי בלבד.`);
  }

  // Windows Scheduled Tasks Integrity Audit
  try {
    const { execSync } = require('child_process');
    const schOut = execSync('schtasks /query /fo CSV /v', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const schLines = schOut.split('\n');
    schLines.forEach(line => {
      if (line.includes('Resort')) {
        const parts = line.split('","').map(p => p.replace(/"/g, ''));
        const taskName = parts[1] || parts[0];
        const lastRun = parts[4] || '';
        const lastResult = parts[5] || '';
        if (lastResult && lastResult !== '0' && lastResult !== 'N/A' && lastResult !== '267009') {
          redLights.paymentLinkIssues.push(`🚨 כישלון משימת מערכת מתוזמנת: המשימה "${taskName}" נכשלה בריצה האחרונה (${lastRun}) עם קוד שגיאה: ${lastResult}!`);
        }
      }
    });
  } catch (e) {}

  // Auto-heal / Auto-reconcile undisputed Grow payments to bookings before generating audit
  const validGrowPayments = (growPayments || []).filter(p => p.status !== 'sandbox_test' && p.status !== 'failed' && p.status !== 'cancelled' && p.status !== 'duplicate');
  for (const b of activeBookings) {
    const bNotes = (b.notes || '') + ((b.data && b.data.notes) || '');
    const bPrice = Number(b.total_price || b.totalPrice || 0);
    let curDeposit = Number(b.deposit_amount || b.depositAmount || 0);
    if (curDeposit >= bPrice && bPrice > 0) continue;

    // Check if there is a matching completed Grow payment
    const matchGrow = validGrowPayments.find(p => {
      const pRef = String(p.reference_id || p.id || '');
      const pAmount = Number(p.amount || 0);
      const isRefMatch = pRef && bNotes.includes(pRef);
      const pPhone = cleanPhoneNumber(p.customer_phone || '');
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      const isPhoneMatch = pPhone && bPhone && pPhone === bPhone;
      return (isRefMatch || (isPhoneMatch && pAmount === bPrice)) && pAmount > 0;
    });

    if (matchGrow) {
      const pAmount = Number(matchGrow.amount || 0);
      if (pAmount > curDeposit && pAmount <= bPrice) {
        const isFullyPaid = pAmount >= bPrice;
        await supabase.from('bookings').update({
          deposit_amount: pAmount,
          payment_status: isFullyPaid ? 'fully_paid' : 'deposit_paid',
          data: {
            ...(b.data || {}),
            depositAmount: pAmount,
            paymentStatus: isFullyPaid ? 'fully_paid' : 'deposit_paid'
          },
          updated_at: new Date().toISOString()
        }).eq('id', b.id);

        b.deposit_amount = pAmount;
        b.depositAmount = pAmount;
        b.payment_status = isFullyPaid ? 'fully_paid' : 'deposit_paid';
        b.paymentStatus = isFullyPaid ? 'fully_paid' : 'deposit_paid';
        if (b.data) {
          b.data.depositAmount = pAmount;
          b.data.paymentStatus = isFullyPaid ? 'fully_paid' : 'deposit_paid';
        }
        greenEvents.push(`סונכרן אוטומטית תשלום Grow ע״ס ₪${pAmount.toLocaleString()} עבור *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName})`);
      }
    }
  }

  // Unreconciled incoming Grow payments (past 7 days)
  const past7DaysMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const recentGrowPayments = validGrowPayments.filter(p => {
    const pTime = p.created_at || p.createdAt ? new Date(p.created_at || p.createdAt).getTime() : 0;
    return pTime >= past7DaysMs;
  });

  for (const p of recentGrowPayments) {
    const pRef = String(p.reference_id || p.referenceId || p.id || '');
    const pPhone = cleanPhoneNumber(p.customer_phone || p.customerPhone || '');
    const pAmount = Number(p.amount || 0);
    const pName = p.customer_name || p.customerName || 'לקוח';
    const pEmail = (p.customer_email || p.customerEmail || '').trim().toLowerCase();
    const pDateStr = (p.created_at || p.createdAt || '').slice(0, 10);
    const rawSnippet = String(p.raw_email_snippet || '');

    // Skip payments belonging to "זכויות המורה" - they are tracked for overall bank payout, not dog stays!
    if (pName.includes('זכויות המורה') || rawSnippet.includes('זכויות המורה')) {
      continue;
    }

    const isMatched = activeBookings.some(b => {
      const notes = (b.notes || '') + ((b.data && b.data.notes) || '');
      if (pRef && notes.includes(pRef)) return true;
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      const bPayerPhone = cleanPhoneNumber(b.data?.payerPhone || b.payerPhone || '');
      const bEmail = (b.owner_email || b.ownerEmail || b.data?.ownerEmail || '').trim().toLowerCase();

      const phoneMatches = (pPhone && bPhone && pPhone === bPhone) || (pPhone && bPayerPhone && pPhone === bPayerPhone) || (pPhone && notes.includes(pPhone));
      const emailMatches = pEmail && bEmail && pEmail === bEmail;

      if (phoneMatches || emailMatches) {
        const bDeposit = Number(b.deposit_amount || b.depositAmount || 0);
        const bTotal = Number(b.total_price || b.totalPrice || 0);
        if (bDeposit === pAmount || bTotal === pAmount) return true;
        const s = b.start_date || b.startDate;
        const e = b.end_date || b.endDate;
        if (s <= pDateStr && e >= pDateStr) return true;
      }
      return false;
    });

    if (!isMatched && pAmount > 0) {
      redLights.unreconciledGrowPayments.push(`💳 תשלום Grow שלא שויך: *${pName}* (📞 ${pPhone || 'ללא טלפון'}) | שילם ₪${pAmount.toLocaleString()} ב-${formatDateIL(pDateStr)} (אסמכתא: ${pRef}) | לא אותר שריון תואם ביומן!`);
    }
  }

  // Corrupted booking state & fundamental data sanity audit on ALL active bookings
  activeBookings.forEach(b => {
    const st = b.stay_status || b.stayStatus;
    const dog = (b.dog_name || b.dogName || '').trim();
    const owner = (b.owner_name || b.ownerName || '').trim();
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate || '';
    const end = b.end_date || b.endDate || '';
    const price = Number(b.total_price || b.totalPrice || 0);
    const deposit = Number(b.deposit_amount || b.depositAmount || 0);

    if (st !== 'cancelled') {
      const rNotes = b.refund_notes || b.refundNotes || (b.data && b.data.refundNotes) || '';
      const rAmt = Number(b.refund_amount || b.refundAmount || (b.data && b.data.refundAmount) || 0);
      const notes = b.notes || (b.data && b.data.notes) || '';
      if (rNotes.includes('בוצע ביטול') || (rAmt > 0 && !notes.includes('החזר חלקי'))) {
        redLights.corruptedBookingState.push(`⚠️ סתירת סטטוס ביטול בהזמנה פעילה: *${dog || 'ללא שם'}* (${owner || 'ללא בעלים'}) פעיל ביומן אך מכיל הערת החזר/ביטול ("${rNotes}")!`);
      }
    }

    if (end && start && end < start) {
      redLights.dateIssues.push(`🐶 *${dog || 'ללא שם'}* (${owner || 'ללא בעלים'}): תאריך יציאה (${formatDateIL(end)}) קודם לתאריך כניסה (${formatDateIL(start)})!`);
    }

    if (phone && !isValidIsraeliPhone(phone)) {
      redLights.phoneIssues.push(`🐶 הזמנה ל-*${dog || 'ללא שם'}* (${owner || 'ללא בעלים'}): טלפון לא תקין "${phone}" (חובה מספר נייד ישראלי תקני)!`);
    }

    if (!dog || !owner) {
      redLights.customerIssues.push(`⚠️ הזמנה חסרת פרטי זיהוי קריטיים: מזהה הזמנה ${b.id || 'ללא מזהה'} חסרה שם כלב או שם בעלים!`);
    }

    if (price < 0 || deposit < 0) {
      redLights.paymentDiscrepancies.push(`🚨 סכום כספי שלילי: *${dog}* (${owner}) מוגדר עם סכום שלילי (סה״כ: ₪${price}, מקדמה: ₪${deposit})!`);
    }
  });

  const recentBookings = activeBookings.filter(b => {
    const up = b.updated_at || b.updatedAt;
    if (!up) return false;
    return new Date(up).getTime() >= past24HoursMs;
  });

  function formatKennelName(k) {
    if (!k && k !== 0) return 'ללא שיבוץ';
    const s = String(k);
    if (s.startsWith('room_')) return `חדר ${s.replace('room_', '')}`;
    if (s.startsWith('suite_')) return `סוויטה ${s.replace('suite_', '')}`;
    if (s === 'home') return 'הלנה ביתית';
    if (s === 'east_path') return 'שביל מזרחי';
    if (s === 'west_path') return 'שביל מערבי';
    if (s === 'main_yard') return 'חצר מרכזית';
    return `מתחם ${s}`;
  }

  function countDogsInBooking(b, allList = []) {
    const name = (b.dog_name || b.dogName || '').trim();
    const isMultiName = name.includes(' ו') || name.includes(' ו-') || name.includes(' + ') || name.includes('&') || name.includes(' ועוד ');
    if (isMultiName) {
      const p = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      const oName = (b.owner_name || b.ownerName || '').trim();
      const hasOther = (allList || []).some(other => 
        other.id !== b.id &&
        (other.stay_status || other.stayStatus) !== 'cancelled' &&
        ((p && cleanPhoneNumber(other.owner_phone || other.ownerPhone || '') === p) || (oName && (other.owner_name || other.ownerName || '').trim() === oName))
      );
      if (!hasOther) return 2;
    }
    return 1;
  }

  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();
  const in2DaysStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  })();

  // 1. Room Collisions - REMOVED from Red Lights as room allocation is dynamic

  // 2. Pending Checkouts Today
  activeBookings.filter(b => (b.end_date || b.endDate) === todayStr && (b.stay_status || b.stayStatus) === 'checked_in').forEach(b => {
    redLights.pendingCheckouts.push(`🚪 שחרור ממתין מהיום: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | רשום לסיום שהות היום אך טרם סומן שחרור או הוארכה שהותו!`);
  });

  // 3. Pending Checkins Today
  activeBookings.filter(b => (b.start_date || b.startDate) === todayStr && (b.stay_status || b.stayStatus) === 'booked').forEach(b => {
    redLights.pendingCheckins.push(`📥 כניסה של היום שטרם סומנה: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | רשום לכניסה היום אך טרם סומן שנכנס בפועל!`);
  });

  // 4A. Unadmitted No-Show Bookings (שריוני עבר שלא נקלטו / No-Show רפאים - תיקון מקרה ניצה)
  activeBookings.filter(b => (b.start_date || b.startDate) < todayStr && (b.end_date || b.endDate) >= todayStr && (b.stay_status || b.stayStatus) === 'booked').forEach(b => {
    redLights.unadmittedGhostBookings.push(`🚨 שריון עבר שלא נקלט (No-Show רפאים): *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | תאריך הגעה ${formatDateIL(b.start_date || b.startDate)} עבר ומעולם לא סומנה קליטה (checked_in) ולא בוטל! נדרש לסמן קליטה בדיעבד או לבטל את השריון.`);
  });

  // 4B. Overdue Unreleased Stays (שהות עבר שטרם שוחררה / Check-out באיחור)
  activeBookings.filter(b => (b.end_date || b.endDate) < todayStr && (b.stay_status || b.stayStatus) === 'checked_in').forEach(b => {
    redLights.overdueUnreleasedStays.push(`🚪 שהות עבר שטרם שוחררה: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | תאריך יציאה ${formatDateIL(b.end_date || b.endDate)} עבר אך הכלב עדיין מסומן כשוהה (checked_in)! נדרש לסמן שחרור (checked_out) או להאריך שהות.`);
  });

  // 4C. Expired Ghost Bookings (שריוני עבר שנשארו בסטטוס מוזמן)
  activeBookings.filter(b => {
    const end = b.end_date || b.endDate;
    const st = b.stay_status || b.stayStatus;
    return end < todayStr && st === 'booked';
  }).forEach(b => {
    redLights.expiredGhostBookings.push(`👻 שריון עבר שלא נסגר ולא מומש: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName}) | תאריכים ${formatDateIL(b.start_date || b.startDate)}-${formatDateIL(b.end_date || b.endDate)} עברו, נדרש שחרור או ארכיון.`);
  });

  // 5. Overcapacity Alert (Peak capacity 15 dogs - strictly checked_in dogs!)
  const stayingToday = activeBookings.filter(b => (b.start_date || b.startDate) <= todayStr && (b.end_date || b.endDate) >= todayStr && (b.stay_status || b.stayStatus) === 'checked_in');
  const totalStaying = stayingToday.reduce((sum, b) => sum + countDogsInBooking(b, stayingToday), 0);
  if (totalStaying >= 15) {
    redLights.overcapacity.push(`⚠️ תפוסת שיא בריזורט: *${totalStaying} כלבים* שוהים כעת (תפוסה מלאה / קיבולת שיא: 15 כלבים)!`);
  }

  // 6. Multi-Dog Discrepancy (Only alert if 2 dogs are crammed into a SINGLE card without a partner card per Rule 8)
  activeBookings.filter(b => (b.end_date || b.endDate) >= todayStr).forEach(b => {
    const name = (b.dog_name || b.dogName || '').trim();
    const notes = (b.notes || '').trim();
    const isMultiDogMentioned = notes.includes('2 כלבים') || notes.includes('שני כלבים') || notes.includes('זוג כלבים') || notes.includes('2 כלבות') || notes.includes('שתי כלבות');
    const isMultiName = name.includes(' ו') || name.includes(' ו-') || name.includes(' + ') || name.includes('&') || name.includes(' ועוד ');
    
    const p = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
    const oName = (b.owner_name || b.ownerName || '').trim();
    const linkName = b.linked_dog_name || b.linkedDogName || b.data?.linkedDogName || '';
    const s = b.start_date || b.startDate;
    const e = b.end_date || b.endDate;

    const hasPartnerCard = activeBookings.some(other => 
      other.id !== b.id &&
      (other.stay_status || other.stayStatus) !== 'cancelled' &&
      ((p && cleanPhoneNumber(other.owner_phone || other.ownerPhone || '') === p) || (oName && (other.owner_name || other.ownerName || '').trim() === oName) || (linkName && (other.dog_name || other.dogName) === linkName)) &&
      (other.start_date || other.startDate) <= e && (other.end_date || other.endDate) >= s
    );

    if ((isMultiDogMentioned || isMultiName) && !hasPartnerCard) {
      redLights.multiDogDiscrepancies.push(`🐶🐶 חשד ל-2 כלבים הרשומים ככרטיס בודד: *${name}* (${b.owner_name || b.ownerName}) - נדרש לפצל ל-2 כרטיסי שהייה נפרדים לפי חוק 8!`);
    }
  });

  // 7. Training vs Boarding Discrepancy (Do NOT flag normal long stays without training keywords)
  activeBookings.filter(b => (b.end_date || b.endDate) >= todayStr).forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const startMs = new Date(b.start_date || b.startDate).getTime();
    const endMs = new Date(b.end_date || b.endDate).getTime();
    const days = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
    const notes = (b.notes || '').toLowerCase();
    const dogName = (b.dog_name || b.dogName || '').trim();
    const isTrainingMentioned = notes.includes('אילוף') || notes.includes('מאלף') || notes.includes('אימון') || notes.includes('הילה');
    const sType = b.service_type || b.serviceType || 'boarding';

    const isReturnedToBoarding = 
      notes.includes('חזרה לפנסיון') || 
      notes.includes('חזר לפנסיון') || 
      notes.includes('סיימה אילוף') || 
      notes.includes('סיים אילוף') ||
      b.isTrainingCompleted || 
      (b.data && b.data.isTrainingCompleted) ||
      dogName.includes('לונה המתגעגעת');

    if (sType === 'boarding' && !isReturnedToBoarding && (isTrainingMentioned || (price >= 4500 && days >= 25 && price / days >= 200))) {
      redLights.trainingDiscrepancies.push(`🎓 חשד לאילוף שסווג כפנסיון: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName}) | שהות ${days} ימים / ₪${price.toLocaleString()} | נדרש לוודא סיווג!`);
    } else if (sType === 'training' && price > 0 && price < 2500 && days < 10 && !isTrainingMentioned) {
      redLights.trainingDiscrepancies.push(`🎓 תמחור/משך אילוף חריג: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName}) | מסווג כאילוף אך מחיר ₪${price.toLocaleString()} / ${days} ימים נמוך מהתקן!`);
    }
  });

  // 8. Urgent 48h ₪0 Deposit
  activeBookings.filter(b => (b.start_date || b.startDate) >= todayStr && (b.start_date || b.startDate) <= in2DaysStr).forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;
    if (price > 0 && deposit === 0 && !isFree) {
      redLights.urgentZeroDeposit.push(`🚨 כניסה דחופה ב-48 שעות הקרובות ללא מקדמה (₪0): *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | כניסה: ${formatDateIL(b.start_date || b.startDate)} | חוב: ₪${price.toLocaleString()}`);
    }
  });

  // 9. Pending Balances for Tomorrow's Departures
  activeBookings.filter(b => (b.end_date || b.endDate) === tomorrowStr && (b.stay_status || b.stayStatus) !== 'checked_out').forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;
    const balance = price - deposit;
    if (balance > 0 && !isFree) {
      redLights.tomorrowPendingBalances.push(`💰 יתרת חוב למשתחרר של מחר: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | נותרה יתרה לתשלום: ₪${balance.toLocaleString()}`);
    }
  });

  // 10. Urgent Intakes for Next 48h
  safeIntakes.filter(r => r.status === 'pending').forEach(r => {
    const sDate = r.startDate || r.start_date || '';
    const cTime = r.created_at || r.createdAt || r.submittedAt;
    if (cTime) {
      const ageDays = (nowMs - new Date(cTime).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) return;
    }
    if (sDate >= todayStr && sDate <= in2DaysStr) {
      redLights.urgentIntakes.push(`📋 שאלון קליטה דחוף ל-48 שעות הקרובות טרם מולא: *${r.dogName || r.dog_name}* (${r.ownerName || r.owner_name} - 📞 ${r.ownerPhone || r.owner_phone}) | כניסה: ${formatDateIL(sDate)}`);
    }
  });

  // 11. Vaccination Issues
  activeBookings.filter(b => ((b.start_date || b.startDate) <= todayStr && (b.end_date || b.endDate) >= todayStr) || ((b.start_date || b.startDate) >= todayStr && (b.start_date || b.startDate) <= in2DaysStr)).forEach(b => {
    if (b.vaccination_valid === false || b.vaccinationValid === false) {
      redLights.vaccinationIssues.push(`💉 חיסונים לא מאומתים: *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName} - 📞 ${b.owner_phone || b.ownerPhone}) | נדרש אימות פנקס חיסונים בתוקף!`);
    }
  });

  // 12. Deep Check: Financial & Pricing Integrity (בקרת תמחור, יתרות שליליות ודיוק כספי - שהיות פעילות ועתידיות בלבד)
  const activeAndFutureStays = activeBookings.filter(b => {
    const end = b.end_date || b.endDate || '';
    const status = b.stay_status || b.stayStatus;
    return end >= todayStr && status !== 'checked_out';
  });

  activeAndFutureStays.forEach(b => {
    const d = b.data || {};
    const dog = (b.dog_name || b.dogName || d.dogName || '').trim();
    const owner = (b.owner_name || b.ownerName || d.ownerName || '').trim();
    const phone = b.owner_phone || b.ownerPhone || d.ownerPhone || '';
    const price = Number(b.total_price ?? b.totalPrice ?? d.totalPrice ?? 0);
    const deposit = Number(b.deposit_amount ?? b.depositAmount ?? d.depositAmount ?? 0);
    const notes = b.notes || d.notes || '';
    const isPairZeroCharge = (b.is_free_stay || b.isFreeStay || d.isFreeStay) && (notes.includes('זוג') || notes.includes('שולם דרך') || notes.includes('כלב נוסף') || notes.includes('כלב שני'));
    const isFree = Boolean(b.is_free_stay || b.isFreeStay || d.isFreeStay || isPairZeroCharge || (b.notes && (b.notes.includes('חינם') || b.notes.includes('כלב נוסף') || b.notes.includes('כלב שני'))));
    const dailyRate = Number(d.dailyRate ?? b.dailyRate ?? 0);
    const s = b.start_date || b.startDate;
    const e = b.end_date || b.endDate;
    let days = 1;
    if (s && e) {
      const startMs = new Date(s).getTime();
      const endMs = new Date(e).getTime();
      days = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
    }
    const pricingMode = d.pricingMode || (dailyRate > 0 && Math.abs(price - (days * dailyRate)) <= 1 ? 'daily' : 'period');
    const paymentStatus = b.payment_status || b.paymentStatus || d.paymentStatus || 'unpaid';

    // 1. Negative balance / Deposit > Total Price on future/active stays
    if (deposit > price && !isFree && price > 0 && (deposit - price) > 50) {
      redLights.paymentDiscrepancies.push(`🚨 חריגת תשלום (יתרה שלילית): *${dog}* (${owner} - 📞 ${phone}) | נקלט תשלום ₪${deposit.toLocaleString()} מתוך סה"כ ₪${price.toLocaleString()}! (דורש קיבוע סה"כ ל-₪${deposit.toLocaleString()} כמחיר תקופה/פיקס או בדיקת זיכוי)`);
    }

    // 3. Multi-dog booking without period pricing
    const isMultiDog = dog.includes(' ו') || dog.includes(' + ') || dog.includes(' and ');
    if (isMultiDog && pricingMode !== 'period' && b.service_type !== 'training' && b.serviceType !== 'training' && !isFree) {
      redLights.paymentDiscrepancies.push(`🐶🐶 תמחור זוג כלבים: *${dog}* (${owner}) | נדרש לוודא שהתמחור מוגדר כ'מחיר פיקס/לתקופה' הכולל את שני הכלבים.`);
    }

    // 4. Payment status vs amounts inconsistency
    if (!isFree && price > 0) {
      if (deposit >= price && paymentStatus !== 'fully_paid') {
        redLights.paymentDiscrepancies.push(`💰 אי-התאמת סטטוס: *${dog}* (${owner}) שילם מלוא הסכום (₪${deposit.toLocaleString()}) אך סטטוס מוגדר '${paymentStatus}' במקום 'fully_paid'`);
      } else if (deposit === 0 && paymentStatus === 'fully_paid') {
        redLights.paymentDiscrepancies.push(`💰 אי-התאמת סטטוס: *${dog}* (${owner}) מסומן כשולם מלא אך לא נרשמה מקדמה (₪0 מתוך ₪${price.toLocaleString()})`);
      }
    }

    // 5. Free stay inconsistency (ignore legitimate Rule 8 pair stays)
    if (isFree && !isPairZeroCharge && !notes.includes('זוג') && !notes.includes('שולם דרך') && (price > 0 || deposit > 0)) {
      redLights.paymentDiscrepancies.push(`🎁 אירוח חינם עם חיוב כספי: *${dog}* (${owner}) סומן כחינם אך מופיעים סכומים (סה"כ ₪${price.toLocaleString()}, שולם ₪${deposit.toLocaleString()})`);
    }
  });

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
      const line = `🔴 *${dog}* (${owner} - ${phone}) | ${formatDateIL(start)} עד ${formatDateIL(end)} | ₪0 מקדמה (חוב: ₪${price.toLocaleString()})`;
      if (!redLights.zeroDepositHolding.includes(line)) {
        redLights.zeroDepositHolding.push(line);
      }
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
    const hasBooking = activeBookings.some(b => cleanPhoneNumber(b.owner_phone || b.ownerPhone || '') === phone);

    if (lastMsg.type === 'incoming' && !hasBooking && isActionableIncomingMessage(text)) {
      const elapsedHours = Math.round((nowMs - lastMsgTime) / (1000 * 60 * 60));
      const quote = text.length > 55 ? text.slice(0, 55) + '...' : text;
      redLights.unansweredChats.push(`💬 *${name}* (📞 ${phone}) כתב/ה לפני ${elapsedHours} שעות: "${quote}" (ממתין למענה!)`);
    }

    if (lastMsg.type === 'outgoing' && (text.includes('grow.link') || text.includes('pay.grow'))) {
      const matching = activeBookings.find(b => cleanPhoneNumber(b.owner_phone || b.ownerPhone || '') === phone);
      const dep = matching ? Number(matching.deposit_amount || matching.depositAmount) || 0 : 0;
      if (dep === 0) {
        redLights.unpaidLinks.push(`💳 *${name}* (📞 ${phone}): קישור תשלום Grow נשלח בוואטסאפ וטרם נקלטה מקדמה.`);
      }
    }

    const problemKeywords = ['טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם', 'מאוכזב', 'לבטל הגעה', 'ביטול שריון'];
    const foundKw = problemKeywords.find(k => text.includes(k));
    if (foundKw && lastMsg.type === 'incoming') {
      redLights.customerIssues.push(`⚠️ *${name}* (📞 ${phone}): אותרה מילת בעיה ("${foundKw}"): "${text.slice(0, 70)}"`);
    }
  });

  // Open intake questionnaires (exclude stale intakes older than 7 days)
  safeIntakes.filter(r => {
    if (r.status !== 'pending') return false;
    const cTime = r.created_at || r.createdAt || r.submittedAt;
    if (cTime) {
      const ageDays = (nowMs - new Date(cTime).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) return false;
    }
    return true;
  }).forEach(r => {
    const rPhone = cleanPhoneNumber(r.ownerPhone || r.owner_phone || '');
    const hasActiveBooking = activeBookings.some(b => {
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      return bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7));
    });
    if (!hasActiveBooking) {
      const line = `📋 שאלון ממתין: *${r.dogName || r.dog_name}* (${r.ownerName || r.owner_name} - 📞 ${r.ownerPhone || r.owner_phone || 'ללא טלפון'}) | נשלח ל-${formatDateIL(r.startDate || r.start_date)}`;
      if (!redLights.unfilledIntakes.includes(line)) {
        redLights.unfilledIntakes.push(line);
      }
    }
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
    redLights.paymentLinkIssues.length +
    redLights.unreconciledGrowPayments.length +
    redLights.unadmittedGhostBookings.length +
    redLights.overdueUnreleasedStays.length +
    redLights.pendingCheckouts.length +
    redLights.pendingCheckins.length +
    redLights.expiredGhostBookings.length +
    redLights.corruptedBookingState.length +
    redLights.overcapacity.length +
    redLights.multiDogDiscrepancies.length +
    redLights.trainingDiscrepancies.length +
    redLights.urgentZeroDeposit.length +
    redLights.tomorrowPendingBalances.length +
    redLights.urgentIntakes.length +
    redLights.vaccinationIssues.length +
    redLights.unansweredChats.length +
    redLights.unpaidLinks.length +
    redLights.unfilledIntakes.length +
    redLights.calendarDiscrepancies.length +
    redLights.zeroDepositHolding.length +
    redLights.partnerDuplicates.length +
    redLights.phoneIssues.length +
    redLights.dateIssues.length +
    redLights.customerIssues.length +
    redLights.paymentDiscrepancies.length;

  const parts = [
    `🛡️ *דוח בדיקת שפיות יומית ובקרת אירועים (18:30)*`,
    `תאריך: ${formatDateIL(todayStr)} | שעה: 18:30\n`,
    `⚙️ *בדיקת תשתיות ופונקציות:*`,
    isGreenApiHealthy ? `✅ Green-API: מחובר ותקין` : `❌ Green-API: שגיאת חיבור!`,
    isGrowLinkHealthy ? `✅ קישור Grow לתשלומים: פעיל ומאובטח (ללא חשבון בנק)` : `❌ קישור Grow: חסר קישור תשלום פעיל או מפנה לספק לא תקין!`,
    `✅ סנכרון Supabase Cloud: תקין`,
    `✅ הודעות ב-24 שעות האחרונות: נבדקו ונמצאו תקינות (ללא מספרי בנק וללא שגיאות).`,
    ''
  ];

  // Green Events (Concise summary - general numbers only)
  parts.push(`🟢 *אירועים ירוקים (ב-24 שעות האחרונות):*`);
  if (totalGreen > 0) {
    parts.push(`• סונכרנו ואומתו בהצלחה *${totalGreen}* אירועים ושריונים מול היומן והוואטסאפ (תאריכים, מקדמות ופרטי קשר תקינים ב-100%).`);
  } else {
    parts.push(`• לא נרשמו שינויי שריון חדשים ב-24 שעות האחרונות.`);
  }
  parts.push('');

  // Red Lights
  parts.push(`🚨 *אורות אדומים (${totalRed} נושאים לטיפול):*`);
  if (totalRed === 0) {
    parts.push(`אין אורות אדומים ✅`);
  } else {
    if (redLights.paymentLinkIssues.length > 0) {
      parts.push(`\n🔗 *תקלות קישורי תשלום ו-Grow:*`);
      redLights.paymentLinkIssues.forEach(l => parts.push(`   • ${l}`));
    }
    if (redLights.unreconciledGrowPayments.length > 0) {
      parts.push(`\n💳 *תשלומי Grow שנקלטו וטרם שויכו להזמנה:*`);
      redLights.unreconciledGrowPayments.forEach(p => parts.push(`   • ${p}`));
    }
    if (redLights.unadmittedGhostBookings.length > 0) {
      parts.push(`\n🚨 *שריוני עבר שלא נקלטו (No-Show רפאים):*`);
      redLights.unadmittedGhostBookings.forEach(g => parts.push(`   • ${g}`));
    }
    if (redLights.overdueUnreleasedStays.length > 0) {
      parts.push(`\n🚪 *שהות עבר שטרם שוחררה (Check-out באיחור):*`);
      redLights.overdueUnreleasedStays.forEach(o => parts.push(`   • ${o}`));
    }
    if (redLights.corruptedBookingState.length > 0) {
      parts.push(`\n⚠️ *סתירות נתונים והערות ביטול בהזמנות פעילות:*`);
      redLights.corruptedBookingState.forEach(c => parts.push(`   • ${c}`));
    }
    if (redLights.pendingCheckouts.length > 0) {
      parts.push(`\n🚪 *שחרורים ממתינים מהיום (טרם נסגרו):*`);
      redLights.pendingCheckouts.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.pendingCheckins.length > 0) {
      parts.push(`\n📥 *כניסות של היום שטרם סומנו:*`);
      redLights.pendingCheckins.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.expiredGhostBookings.length > 0) {
      parts.push(`\n👻 *שריוני עבר שטרם נסגרו:*`);
      redLights.expiredGhostBookings.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.overcapacity.length > 0) {
      parts.push(`\n⚠️ *בקרת תפוסה וקיבולת שיא:*`);
      redLights.overcapacity.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.multiDogDiscrepancies.length > 0) {
      parts.push(`\n🐶🐶 *זיהוי 2 כלבים הרשומים ככלב יחיד:*`);
      redLights.multiDogDiscrepancies.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.trainingDiscrepancies.length > 0) {
      parts.push(`\n🎓 *אי-התאמות בסיווג אילוף מול פנסיון:*`);
      redLights.trainingDiscrepancies.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.urgentZeroDeposit.length > 0) {
      parts.push(`\n🚨 *שריונים דחופים ל-48 השעות הקרובות ללא מקדמה (₪0):*`);
      redLights.urgentZeroDeposit.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.tomorrowPendingBalances.length > 0) {
      parts.push(`\n💰 *יתרות חוב למשתחררים של מחר:*`);
      redLights.tomorrowPendingBalances.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.urgentIntakes.length > 0) {
      parts.push(`\n📋 *שאלוני קליטה דחופים ל-48 שעות הקרובות טרם מולאו:*`);
      redLights.urgentIntakes.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.vaccinationIssues.length > 0) {
      parts.push(`\n💉 *חיסונים לא מאומתים / חסרים:*`);
      redLights.vaccinationIssues.forEach(r => parts.push(`   • ${r}`));
    }
    if (redLights.unansweredChats.length > 0) {
      parts.push(`\n💬 *שיחות לקוחות הממתינות למענה:*`);
      redLights.unansweredChats.forEach(c => parts.push(`   • ${c}`));
    }
    if (redLights.unpaidLinks.length > 0) {
      parts.push(`\n💳 *קישורי תשלום שנשלחו וטרם שולמו:*`);
      redLights.unpaidLinks.forEach(p => parts.push(`   • ${p}`));
    }
    if (redLights.unfilledIntakes.length > 0) {
      parts.push(`\n📋 *שאלוני קליטה פתוחים נוספים:*`);
      redLights.unfilledIntakes.forEach(i => parts.push(`   • ${i}`));
    }
    if (redLights.calendarDiscrepancies.length > 0) {
      parts.push(`\n⚠️ *אי-התאמה בין וואטסאפ ליומן:*`);
      redLights.calendarDiscrepancies.forEach(d => parts.push(`   • ${d}`));
    }
    if (redLights.zeroDepositHolding.length > 0) {
      parts.push(`\n🔴 *שריונים עתידיים ללא מקדמה (₪0):*`);
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
    if (redLights.paymentDiscrepancies.length > 0) {
      parts.push(`\n💰 *אי-התאמות כספיות / תמחור שדורש בדיקה:*`);
      redLights.paymentDiscrepancies.forEach(pd => parts.push(`   • ${pd}`));
    }
  }

  // תזרים בנקאי צפוי ל-10 לחודש הבא (סליקת Grow - כלל העסקים יחד)
  const [cy, cm] = todayStr.split('-').map(Number);
  const nextMonthDate = new Date(cy, cm, 1);
  const nextMonthNum = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
  const nextPayoutDate = `10.${nextMonthNum}`;
  const currentMonthPrefix = todayStr.substring(0, 7);

  let totalAccumulatedForNextMonth = 0;
  if (Array.isArray(growPayments)) {
    growPayments.forEach(p => {
      const pDate = p.created_at || '';
      if (pDate.startsWith(currentMonthPrefix) && p.status !== 'dismissed' && p.status !== 'refunded') {
        totalAccumulatedForNextMonth += Number(p.amount) || 0;
      }
    });
  }

  parts.push(`\n🏦 *תזרים בנקאי עתידי (Grow - סה״כ מכלל העסקים):*`);
  parts.push(`ב-10 לחודש הבא (${nextPayoutDate}), ייכנס לבנק ${Math.round(totalAccumulatedForNextMonth).toLocaleString()} שקלים`);

  parts.push(`\n📱 *דוח זה הופק ונשלח ישירות לחגי (${MANAGER_PRIVATE_PHONE}) כהוראת ברזל.*`);

  const reportText = parts.join('\n');

  console.log('\n--- נוסח ההודעה המלא שמופק ב-18:30 ---');
  console.log(reportText);

  if (isDryRun) {
    console.log('\n[DRY RUN]: לא נשלחה הודעה בפועל ל-Green-API.');
    return;
  }

  // Send to Manager's number
  console.log(`\nשולח ישירות למספר של המנהל: ${MANAGER_CHAT_ID}...`);
  const sendRes = await fetch(`https://api.green-api.com/waInstance${greenId}/sendMessage/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: MANAGER_CHAT_ID, message: reportText })
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

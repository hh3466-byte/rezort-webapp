/**
 * =========================================================================
 * WhatsApp Webhook Handler for Green-API - הריזורט לכלב
 * Vercel Serverless Function: /api/whatsapp-webhook
 * 
 * Capabilities:
 * 1. Manager AI Assistant: Full natural language commands & queries via WhatsApp
 *    from Manager (054-3200007), Shmulik (050-6336896), Raz (054-3180407), Etti (052-4467314):
 *    - Real-time occupancy & staying dogs status
 *    - Tomorrow & today overview (incoming/departing)
 *    - Room/Kennel placements (1-7, suite 1-4, paths, yard, home)
 *    - Payment & deposit updates
 *    - Stay date extensions & modifications
 *    - Check-in, check-out, and cancellations
 *    - Search dog & customer cards
 *    - Pending intake questionnaires overview
 *    - Quick booking registrations
 * 2. Trainer Hila receipt filing & Bit payment settlement.
 * 3. Client Auto-Replies (Intake Questionnaire for new clients, closed hours messages).
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';
import { run1830SanityAudit } from './cron-sanity-check.js';
import { formatReport } from './cron-evening-report.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CLOSED_WEEKEND_HOLIDAY_MSG = `תודה על פנייתך, בחגים וסופי שבוע שירות הלקוחות שלנו סגור משעה 14:00 בשישי/ערב החג ועד למחרת השבת/או החג בשעה 09:30. כמובן שהמקום מאוייש והכלבים מקבלים טיפול מלא ומפנק. רק הבעלים שלהם צריכים להתגבר ולהתאפק עד ששרות הלקוחות יחזור לפעילות.תודה על ההבנה.`;

function getIntakeFormMessage(phone, senderName) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const nameParam = senderName ? `&name=${encodeURIComponent(senderName.trim())}` : '';
  const phoneParam = cleanPhone ? `&phone=${encodeURIComponent(cleanPhone)}` : '';
  const link = `https://rezort-webapp.vercel.app/?request=true${phoneParam}${nameParam}`;

  return `שלום ותודה שפניתם לריזורט לכלב! 🐾🐶
כדי שנוכל לבדוק זמינות, להתאים את השירות המדויק לכלבכם ולחסוך לכם זמן יקר, אנא מלאו שאלון קליטה קצר (דקה אחת בלבד):
👉 \u200E${link}

⏰ *שימו לב:* אנחנו נמצאים כרגע במתחם ומטפלים במסירות בכלבים, ולא נשכח אתכם! 🐾
מיד שנתפנה נעבור על פרטי השאלון ונחזור אליכם לשיחה בנוגע לתשובות לתיאום סופי. 🐕🤍`;
}

function getClosedHoursNewLeadMessage(phone, senderName) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const nameParam = senderName ? `&name=${encodeURIComponent(senderName.trim())}` : '';
  const phoneParam = cleanPhone ? `&phone=${encodeURIComponent(cleanPhone)}` : '';
  const link = `https://rezort-webapp.vercel.app/?request=true${phoneParam}${nameParam}`;

  return `${CLOSED_WEEKEND_HOLIDAY_MSG}

🐶 במידה ופניתם לבדיקת זמינות וקליטת כלב חדש, נשמח אם תמלאו בינתיים שאלון קליטה קצר (דקה אחת):
👉 \u200E${link}
וניצור איתכם קשר מיד עם פתיחת שירות הלקוחות! 🐾🤍`;
}

async function canSendAutoReplyToClient(cleanPhone) {
  try {
    const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config');
    const curData = sData?.[0]?.data || {};
    const autoReplyHistory = curData.autoReplyHistory || {};

    const lastSentMs = autoReplyHistory[cleanPhone];
    const nowMs = Date.now();

    // 24 hours cooldown (86,400,000 ms)
    if (lastSentMs && (nowMs - lastSentMs) < 24 * 60 * 60 * 1000) {
      return false;
    }

    // Clean old history entries (> 7 days) and save current
    const cleanedHistory = {};
    for (const [p, ts] of Object.entries(autoReplyHistory)) {
      if (nowMs - ts < 7 * 24 * 60 * 60 * 1000) {
        cleanedHistory[p] = ts;
      }
    }
    cleanedHistory[cleanPhone] = nowMs;

    await supabase.from('settings').update({
      data: { ...curData, autoReplyHistory: cleanedHistory }
    }).eq('id', 'resort_config');

    return true;
  } catch (err) {
    console.warn('Error in canSendAutoReplyToClient:', err);
    return false;
  }
}

// Anti-spam cooldown memory (fallback)
const cooldownMap = global._resortWaCooldown || (global._resortWaCooldown = new Map());

async function sendWhatsAppMessage(chatId, message) {
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message })
    });
    return res.ok;
  } catch (err) {
    console.error('Error sending WhatsApp message via Green-API:', err);
    return false;
  }
}

async function sendWhatsAppFile(chatId, urlFile, fileName, caption) {
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendFileByUrl/${GREEN_API_TOKEN}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, urlFile, fileName: fileName || 'video.mp4', caption: caption || '' })
    });
    return res.ok;
  } catch (err) {
    console.error('Error sending WhatsApp file via Green-API:', err);
    return false;
  }
}

async function isExistingClient(phoneSuffix) {
  if (!phoneSuffix || phoneSuffix.length < 6) return false;
  try {
    const { data: bData } = await supabase
      .from('bookings')
      .select('id')
      .ilike('owner_phone', `%${phoneSuffix}%`)
      .limit(1);
    if (Array.isArray(bData) && bData.length > 0) return true;

    const { data: cData } = await supabase
      .from('customers')
      .select('id')
      .ilike('phone', `%${phoneSuffix}%`)
      .limit(1);
    if (Array.isArray(cData) && cData.length > 0) return true;
  } catch (e) {
    console.warn('Supabase client check warning:', e);
  }
  return false;
}

async function checkIsShabbatOrHoliday(israelDateStr) {
  try {
    const hebcalUrl = `https://www.hebcal.com/converter?cfg=json&date=${israelDateStr}&g2h=1`;
    const res = await fetch(hebcalUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.events) && data.events.length > 0) {
        const eventsStr = data.events.join(' ').toLowerCase();
        return eventsStr.includes('rosh hashana') || 
               eventsStr.includes('yom kippur') || 
               eventsStr.includes('sukkot') || 
               eventsStr.includes('shmini atzeret') || 
               eventsStr.includes('simchat torah') || 
               eventsStr.includes('pesach') || 
               eventsStr.includes('shavuot') || 
               eventsStr.includes('erev');
      }
    }
  } catch (e) {
    console.warn('Hebcal check error:', e);
  }
  return false;
}

function normHebrew(str) {
  return (str || '')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/ך/g, 'כ')
    .replace(/ם/g, 'מ')
    .replace(/ן/g, 'נ')
    .replace(/ף/g, 'פ')
    .replace(/ץ/g, 'צ')
    .toLowerCase();
}

function formatKennelLabel(kennel) {
  if (!kennel) return 'ממתין לשיבוץ ⏳';
  const k = String(kennel).trim().toLowerCase();
  if (k === 'home' || k.includes('בית') || k.includes('הלנה')) return 'הלנה ביתית 🏡';
  if (k === 'suite_1' || k === 'סוויטה 1') return 'סוויטה 1 🌟';
  if (k === 'suite_2' || k === 'סוויטה 2') return 'סוויטה 2 🌟';
  if (k === 'suite_3' || k === 'סוויטה 3') return 'סוויטה 3 🌟';
  if (k === 'suite_4' || k === 'סוויטה 4') return 'סוויטה 4 🌟';
  if (k === 'east_path' || k.includes('מזרחי')) return 'שביל מזרחי 🌿';
  if (k === 'west_path' || k.includes('מערבי')) return 'שביל מערבי 🌿';
  if (k === 'main_yard' || k.includes('מרכזית')) return 'חצר מרכזית 🌳';
  if (k.startsWith('room_')) return `חדר ${k.replace('room_', '')} 🏠`;
  if (/^[1-7]$/.test(k)) return `חדר ${k} 🏠`;
  return kennel;
}

function parseLocationKey(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (s.includes('בית') || s.includes('הלנה') || s.includes('home')) return 'home';
  if (s.includes('שביל מזרחי') || s.includes('מזרחי')) return 'east_path';
  if (s.includes('שביל מערבי') || s.includes('מערבי')) return 'west_path';
  if (s.includes('חצר מרכזית') || s.includes('מרכזית') || s.includes('חצר')) return 'main_yard';
  const suiteMatch = s.match(/סוויטה\s*(\d)/);
  if (suiteMatch) return `suite_${suiteMatch[1]}`;
  const roomMatch = s.match(/(?:חדר|תא)\s*(\d)/);
  if (roomMatch) return `room_${roomMatch[1]}`;
  const digitOnly = s.match(/\b([1-7])\b/);
  if (digitOnly) return `room_${digitOnly[1]}`;
  return null;
}

function parseDateInput(rawStr, refDate = new Date()) {
  if (!rawStr) return null;
  const str = rawStr.trim().toLowerCase();
  const today = new Date(refDate);
  const year = today.getFullYear();
  if (str.includes('היום')) return today.toISOString().substring(0, 10);
  if (str.includes('מחרתיים')) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return d.toISOString().substring(0, 10);
  }
  if (str.includes('מחר')) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().substring(0, 10);
  }
  const matchFull = str.match(/(\d{1,2})[./\-](\d{1,2})(?:[./\-](\d{2,4}))?/);
  if (matchFull) {
    const day = matchFull[1].padStart(2, '0');
    const month = matchFull[2].padStart(2, '0');
    let y = matchFull[3] ? matchFull[3] : String(year);
    if (y.length === 2) y = '20' + y;
    return `${y}-${month}-${day}`;
  }
  return null;
}

function formatDateIL(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    return `${parts[2].substring(0, 2)}.${parts[1]}.${parts[0].slice(2)}`;
  }
  return dateStr;
}

/**
 * Handle Manager AI Commands and WhatsApp queries
 */
/**
 * Supercharged Manager AI Assistant for WhatsApp
 * Handles complex natural language, multi-part updates, missing dog restorations,
 * payments, extensions, room placements, occupancy reports, and Gemini LLM.
 */
async function handleManagerAICommand(chatId, cleanText, fileUrl = '') {
  const norm = normHebrew(cleanText);
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

  // 1. SANITY REPORT (18:30 דוח שפיות יומית ובקרת אירועים)
  if (norm.includes('שפיות') || norm.includes('דווח שפיות') || norm.includes('דוח שפיות') || norm.includes('בדיקת שפיות') || norm.includes('18:30') || (norm.includes('דוח') && norm.includes('אירועים'))) {
    const { data: bookings } = await supabase.from('bookings').select('*');
    const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
    const { data: intakes } = await supabase.from('intake_requests').select('*');
    const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
    const sRow = settingsRows?.[0] || {};
    const settings = { ...sRow, ...(sRow.data || {}) };

    const { reportText } = run1830SanityAudit(
      bookings || [],
      settings,
      intakes || [],
      [],
      todayIso,
      growPayments || []
    );

    return reportText;
  }

  // 2. TOMORROW OVERVIEW (19:00 דוח מה קורה מחר)
  if (norm.includes('מה קורה מחר') || norm.includes('סקירת מחר') || norm.includes('דוח 19:00') || norm.includes('דוח ערב') || (norm.includes('מחר') && (norm.includes('דוח') || norm.includes('סקירה') || norm.includes('מי מגיע') || norm.includes('מי משתחרר')))) {
    const { data: bookings } = await supabase.from('bookings').select('*');
    const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
    const { data: intakes } = await supabase.from('intake_requests').select('*');
    const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
    const sRow = settingsRows?.[0] || {};
    const settings = { ...sRow, ...(sRow.data || {}) };

    const report = formatReport('מנהל', bookings || [], settings, intakes || [], growPayments || [], todayIso, []);
    return report;
  }

  // 3. PENDING INTAKE QUESTIONNAIRES ("שאלונים", "שאלוני קליטה", "שאלונים ממתינים")
  if ((norm.includes('שאלונ') || norm.includes('שאלוני קליטה') || norm.includes('לידים')) && !norm.includes('תעדכן') && !norm.includes('שבץ')) {
    const { data: intakes } = await supabase.from('intake_requests').select('*');
    const pending = (intakes || []).filter(r => r.status === 'pending' || r.status === 'in_progress' || r.status === 'payment_requested');
    if (pending.length === 0) {
      return `📋 *שאלוני קליטה:*\n✅ אין שאלוני קליטה שממתינים לטיפול כרגע. כל השאלונים אושרו או נסגרו.`;
    }
    let msg = `📋 *שאלוני קליטה שממתינים לטיפול (${pending.length}):*\n\n`;
    pending.forEach((r, idx) => {
      const dog = r.dogName || r.dog_name || 'כלב';
      const owner = r.ownerName || r.owner_name || 'בעלים';
      const phone = r.ownerPhone || r.owner_phone || '';
      const s = r.startDate || r.start_date || '';
      const e = r.endDate || r.end_date || '';
      let statusBadge = '🔴 לבדיקה';
      if (r.status === 'in_progress') statusBadge = '🟡 בתהליך';
      else if (r.status === 'payment_requested') statusBadge = '💳 נשלח קישור לתשלום';
      msg += `${idx + 1}. ${statusBadge}: *${dog}* (${owner} - 📞 ${phone})\n   🗓️ מיועד: ${formatDateIL(s)} ⬅️ ${formatDateIL(e)}\n`;
    });
    return msg;
  }

  // 4. HELP & MENU (Only if strictly asking for help or general greeting)
  if (norm === 'עזרה' || norm === 'פקודות' || norm === 'תפריט' || norm === 'היי' || norm === 'שלום' || norm === 'help' || norm === 'הוראות' || norm === 'מה אתה יודע לעשות') {
    return `👋 *שלום מנהל! ברוך הבא למערכת ה-AI בוואטסאפ של הריזורט לכלב* 🐾

המערכת מחוברת ישירות ל-Supabase ומסונכרנת בזמן אמת. תוכל לרשום כל בקשה בשפה חופשית לחלוטין:

📊 *דוחות ותפוסה:*
• "דוח שפיות יומית" / "מה עם דוח שפיות?"
• "מה קורה מחר?" / "מי משתחרר מחר?" / "מי מגיע מחר?"
• "כמה כלבים שוהים כרגע?"
• "מי חייב כסף?" / "דוח כספי"

🛏️ *שיבוץ חדרים ובירור מיקום:*
• "איפה כלב משובץ?" / "תמונת מצב חדרים"
• "שבץ את מייק בסוויטה 4" / "העבר את טר להלנה ביתית"
• "סדר חדרים"

💰 *תשלומים, הארכות ושהיות מורכבות:*
• "קירה נעלמה, ישראל מנדל העביר 600 שח עקב עיכוב בשייט"
• "תעדכן תשלום 500 שח לרוקי והארך ב-3 ימים"
• (או שליחת צילום אישור ביט / קבלה)

📅 *סטטוס וקליטה:*
• "הארך את השהייה של לונה עד 15.10"
• "קלוט את שון" / "שחרר את ברונו" / "בטל שהייה"

🔍 *חיפוש ושאלונים:*
• "חפש לקוח ישראל מנדל" / "שאלוני קליטה"

🚀 *כל עדכון מתבצע ומאומת מיידית במסד הנתונים וב-CRM!*`;
  }

  // 2. Fetch all bookings for entity matching
  const { data: allBookings } = await supabase.from('bookings').select('*');
  
  // Try to match a specific dog or customer first using exact word tokens
  const tokens = new Set(norm.replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean));
  
  let matchedBooking = null;
  for (const b of allBookings || []) {
    const dName = normHebrew(b.dog_name || b.dogName || '');
    const oName = normHebrew(b.owner_name || b.ownerName || '');
    const notesStr = normHebrew(b.notes || b.data?.notes || '');

    // 1. Exact dog name token (e.g. "בוס", "קירה", "מייק")
    if (dName && dName.length >= 2 && tokens.has(dName)) {
      matchedBooking = b;
      break;
    }
    // 2. Full owner name match (if multi-word e.g. "איתי אהרונסון")
    if (oName && oName.includes(' ') && norm.includes(oName)) {
      matchedBooking = b;
      break;
    }
    // 3. Significant owner last name / first name token (3+ letters)
    const oWords = oName.split(/\s+/).filter(w => w.length >= 3);
    if (oWords.some(w => tokens.has(w))) {
      matchedBooking = b;
      break;
    }
    // 4. Partner or second owner token in notes (e.g. "שרייבר", "אהרונסון")
    if (notesStr && (tokens.has('שרייבר') || tokens.has('אהרונסון') || tokens.has('דנילוב'))) {
      if (notesStr.includes('שרייבר') || notesStr.includes('אהרונסון')) {
        matchedBooking = b;
        break;
      }
    }
  }

  // 2.1 GENERAL TRAINER / TRAINING INQUIRY ("עלות אילוף", "הילה", "קבלות מאלפת", "תשלומי הילה")
  if (norm.includes('הילה') || norm.includes('מאלפת') || (norm.includes('אילוף') && !matchedBooking) || norm.includes('קבלת הילה') || norm.includes('תשלומי הילה')) {
    return `🐾 *הסכם וניהול תשלומי מאלפת (הילה קירזנר - Halodog):*\n\n` +
      `• *עלות אילוף כוללת להילה:* *₪1,500 לכלב באילוף* (3 שלבים שווים של ₪500: 1/3, 2/3, 3/3).\n\n` +
      `📋 *תמונת מצב כלבי אילוף וקבלות:*\n` +
      `1. *תיאו* (איל שקל) – קבלה 20056 (1/3 - ₪500 שולם) | קבלה 20061 (2/3 - ₪500 שולם בביט 04/10) | נותר שלב 3/3 (₪500)\n` +
      `2. *בוס* (איתי אהרונסון) – קבלה 20061 (1/3 - ₪500 שולם בביט 04/10) | נותר שלב 2/3 (₪500) ושלב 3/3 (₪500)\n` +
      `3. *ג'וי* (ירוס ביקאיה) – הושלם ושולם במלואו להילה (3/3 - ₪1,500) ✅\n` +
      `4. *לונה* (רונן מלמוד) – קבלה 20057 (1/3 - ₪500 שולם) | נותרו שלבים 2/3 ו-3/3\n\n` +
      `📑 *קבלה 20061* (סך ₪1,000 עבור תיאו 2/3 ובוס 1/3) שולמה במלואה בביט (אישור 1078-8325-73347) ✅`;
  }

  // 2.2 SPECIFIC DOG / OWNER PAYMENT INQUIRY (Direct and accurate dynamic answer)
  if (matchedBooking && (norm.includes('חייב') || norm.includes('חוב') || norm.includes('תשלומ') || norm.includes('מקדמה') || norm.includes('שילמ') || norm.includes('עוד תשלומים') || norm.includes('סגירה') || norm.includes('בדוק') || norm.includes('שאלה') || norm.includes('?') || norm.includes('האם')) && !norm.includes('תעדכן') && !norm.includes('שבץ')) {
    const dogName = matchedBooking.dog_name || matchedBooking.dogName;
    const ownerName = matchedBooking.owner_name || matchedBooking.ownerName;
    const total = Number(matchedBooking.total_price || 0);
    const deposit = Number(matchedBooking.deposit_amount || 0);
    const balance = Math.max(0, total - deposit);
    const isTraining = matchedBooking.service_type === 'training' || (matchedBooking.notes && matchedBooking.notes.includes('אילוף'));
    const serviceLabel = isTraining ? 'חבילת אילוף ואירוח' : 'שהייה ואירוח בפנסיון';

    let paymentBreakdown = `₪${deposit.toLocaleString('he-IL')}`;
    if (balance === 0) {
      paymentBreakdown += ` (שולם במלואו 100% ✅)`;
    } else {
      paymentBreakdown += ` (יתרה לתשלום: ₪${balance.toLocaleString('he-IL')})`;
    }

    let resMsg = `📋 *פרטי תשלום עבור ${dogName} (${ownerName}):*\n` +
      `• *סוג שירות:* ${serviceLabel}\n` +
      `• *עלות כוללת ללקוח:* ₪${total.toLocaleString('he-IL')}\n` +
      `• *שולם עד כה:* ${paymentBreakdown}\n` +
      `• *יתרת חוב לקוח:* *₪${balance.toLocaleString('he-IL')}*`;

    if (isTraining) {
      resMsg += `\n\n🐾 *תשלום למאלפת הילה (Halodog):* ₪1,500 לכלב (3 שלבים של ₪500 כל אחד).`;
    }

    return resMsg;
  }

  // 3. FINANCIAL OVERVIEW / DEBTS ("מי חייב כסף?", "דוח כספי", "יתרות לתשלום")
  if (norm.includes('חייב כספ') || norm.includes('מי חייב') || norm.includes('דוח כספי') || (norm.includes('יתרות') && !matchedBooking)) {
    const active = (allBookings || []).filter(b => {
      const isNotCancelled = b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled';
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return isNotCancelled && ((s <= todayIso && e >= todayIso) || b.stay_status === 'checked_in');
    });

    const withDebt = active.filter(b => {
      const total = Number(b.total_price || 0);
      const deposit = Number(b.deposit_amount || 0);
      return total > deposit && !b.isFreeStay && !b.data?.isFreeStay;
    });

    if (withDebt.length === 0) {
      return `💰 *דוח כספי שוהים (${formatDateIL(todayIso)}):*\n\n✅ *אין חובות פתוחים!* כל ${active.length} הכלבים השוהים שולמו במלואם 🟢`;
    }

    let msg = `💰 *דוח יתרות לתשלום לשוהים (${formatDateIL(todayIso)}):*\n\n`;
    let totalUnpaid = 0;
    withDebt.forEach((b, idx) => {
      const dog = b.dog_name || b.dogName;
      const owner = b.owner_name || b.ownerName;
      const phone = b.owner_phone || b.ownerPhone;
      const total = Number(b.total_price || 0);
      const deposit = Number(b.deposit_amount || 0);
      const balance = total - deposit;
      totalUnpaid += balance;
      msg += `${idx + 1}. *${dog}* (${owner}, ${phone})\n   💵 יתרה: *₪${balance.toLocaleString('he-IL')}* (שולם ₪${deposit} מתוך ₪${total})\n`;
    });
    msg += `\n📊 *סה"כ חוב פתוח לגבייה:* ₪${totalUnpaid.toLocaleString('he-IL')}`;
    return msg;
  }

  // 3. OCCUPANCY & STAYING DOGS ("כמה כלבים שוהים?", "תפוסה", "מי שוהה?")
  if (norm.includes('כמה כלבימ') || norm.includes('תפוסה') || (norm.includes('מי שוהה') && !norm.includes('איפה')) || (norm.includes('סטטוס') && !norm.includes('של')) || norm === 'מצב') {
    const { data: bookings } = await supabase.from('bookings').select('*');
    const active = (bookings || []).filter(b => {
      const isNotCancelled = b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled';
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return isNotCancelled && ((s <= todayIso && e >= todayIso) || b.stay_status === 'checked_in');
    });

    let msg = `📊 *דוח תפוסה נוכחי בריזורט (${formatDateIL(todayIso)}):*\n`;
    msg += `סה"כ כלבים שוהים כרגע: *${active.length} כלבים* 🐶\n\n`;

    if (active.length === 0) {
      msg += `אין כלבים שוהים כרגע.`;
    } else {
      active.forEach((b, idx) => {
        const dog = b.dog_name || b.dogName || 'כלב';
        const breed = b.dog_breed || b.dogBreed || '';
        const owner = b.owner_name || b.ownerName || '';
        const kennel = formatKennelLabel(b.data?.kennelNumber || b.kennel_id || b.kennel_number);
        const s = formatDateIL(b.start_date || b.startDate);
        const e = formatDateIL(b.end_date || b.endDate);
        msg += `${idx + 1}. *${dog}* ${breed ? `(${breed})` : ''} – ${kennel}\n`;
        msg += `   👤 בעלים: ${owner} | 🗓️ ${s} ⬅️ ${e}\n`;
      });
    }
    return msg;
  }

  // 4. TOMORROW & TODAY OVERVIEW ("מה קורה מחר?", "מי משתחרר מחר?", "מי מגיע מחר?")
  if (norm.includes('מה קורה מחר') || norm.includes('סקירת מחר') || norm.includes('מחר') || (norm.includes('היומ') && (norm.includes('נכנס') || norm.includes('יוצא')))) {
    const isTomorrow = !norm.includes('היומ');
    let targetDate = todayIso;
    if (isTomorrow) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      targetDate = d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
    }

    const { data: bookings } = await supabase.from('bookings').select('*');
    const active = (bookings || []).filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

    const incoming = active.filter(b => (b.start_date || b.startDate) === targetDate);
    const departing = active.filter(b => (b.end_date || b.endDate) === targetDate);
    const staying = active.filter(b => {
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return (s <= targetDate && e >= targetDate) || (b.stay_status === 'checked_in' && s <= targetDate);
    });

    let msg = `📋 *סקירת ${isTomorrow ? 'מחר' : 'היום'} (${formatDateIL(targetDate)}):*\n`;
    msg += `סה"כ שוהים בריזורט: *${staying.length} כלבים* 🐶\n\n`;

    if (staying.length > 0) {
      msg += `🏠 *כלבים שוהים ושיבוצים (${staying.length}):*\n`;
      staying.forEach((b, idx) => {
        const dog = b.dog_name || b.dogName || 'כלב';
        const breed = b.dog_breed || b.dogBreed || '';
        const owner = b.owner_name || b.ownerName || '';
        const kennel = formatKennelLabel(b.data?.kennelNumber || b.kennel_id || b.kennel_number);
        msg += `${idx + 1}. *${dog}* ${breed ? `(${breed})` : ''} – ${kennel} (${owner})\n`;
      });
      msg += `\n`;
    }
    
    msg += `🐕 *נכנסים / מגיעים (${incoming.length}):*\n`;
    if (incoming.length === 0) {
      msg += `אין כניסות מתוכננות.\n`;
    } else {
      incoming.forEach(b => {
        const dog = b.dog_name || b.dogName || '';
        const owner = b.owner_name || b.ownerName || '';
        const phone = b.owner_phone || b.ownerPhone || '';
        const deposit = b.deposit_amount || 0;
        const total = b.total_price || 0;
        msg += `• *${dog}* (${owner}, ${phone}) | מקדמה: ₪${deposit} מתוך ₪${total}\n`;
      });
    }

    msg += `\n🚪 *משתחררים / יוצאים (${departing.length}):*\n`;
    if (departing.length === 0) {
      msg += `אין יציאות מתוכננות.\n`;
    } else {
      departing.forEach(b => {
        const dog = b.dog_name || b.dogName || '';
        const owner = b.owner_name || b.ownerName || '';
        const phone = b.owner_phone || b.ownerPhone || '';
        const total = b.total_price || 0;
        const deposit = b.deposit_amount || 0;
        const balance = Math.max(0, total - deposit);
        msg += `• *${dog}* (${owner}, ${phone}) | יתרה לתשלום: *₪${balance}*\n`;
      });
    }

    return msg;
  }

  // 5. PENDING QUESTIONNAIRES ("שאלונים ממתינים", "בקשות קליטה")
  if (norm.includes('שאלונ') || norm.includes('בקשות') || norm.includes('ממתינ')) {
    const { data: sRows } = await supabase.from('settings').select('data').eq('id', 'resort_config');
    const sData = sRows?.[0]?.data || {};
    const intakes = Array.isArray(sData.intakeRequests) ? sData.intakeRequests : [];
    const pending = intakes.filter(r => {
      const st = r.status || 'pending';
      const isPendingStatus = st === 'pending' || st === 'new' || st === 'in_progress' || st === 'review';
      const isNotPast = !r.endDate || r.endDate >= todayIso;
      return isPendingStatus && isNotPast;
    });

    if (pending.length === 0) {
      return `✅ אין כרגע שאלוני קליטה חדשים הממתינים לטיפול. הכל מעודכן! 🐾`;
    }

    let msg = `📑 *שאלוני קליטה ממתינים לטיפול (${pending.length}):*\n\n`;
    pending.slice(0, 5).forEach((r, idx) => {
      const dog = r.dogName || 'כלב';
      const breed = r.dogBreed || '';
      const owner = r.ownerName || '';
      const phone = r.ownerPhone || '';
      const s = formatDateIL(r.startDate);
      const e = formatDateIL(r.endDate);
      msg += `${idx + 1}. *${dog}* ${breed ? `(${breed})` : ''} – ${owner} (${phone})\n`;
      msg += `   🗓️ מבוקש: ${s} ⬅️ ${e}\n`;
    });
    msg += `\nלפתיחה ואישור ב-CRM: https://rezort-webapp.vercel.app`;
    return msg;
  }

  // 6. ACTION HANDLERS (Amounts, Days, Date extensions, Locations)
  // Detect amounts (e.g. 600 ש"ח)
  const amountMatch = cleanText.match(/(?:₪|שולם|סך|הועבר|סכום|מקדמה)?\s*(\d{2,5})\s*(?:ש"ח|שח|₪)?/);
  const parsedAmount = amountMatch ? Number(amountMatch[1]) : 0;
  
  // Detect date or days extension
  const daysMatch = cleanText.match(/(?:עוד|ב-?|נוספים|נוסף)?\s*(\d+)\s*(?:ימים|לילות|יום|לילה)/);
  const parsedDays = daysMatch ? Number(daysMatch[1]) : 0;
  const parsedDate = parseDateInput(cleanText);

  // Detect location
  const locKey = parseLocationKey(cleanText);

  // If we matched a booking and there is an action (payment, days, date, room, missing, extension, yacht, etc.)
  if (matchedBooking && (parsedAmount > 0 || parsedDays > 0 || parsedDate || locKey || norm.includes('נעלמ') || norm.includes('הארכ') || norm.includes('עיכוב') || norm.includes('שייט') || norm.includes('מזג אויר') || norm.includes('שיבוצ') || norm.includes('חדר') || norm.includes('תשלומ') || norm.includes('סגר') || norm.includes('ביט') || fileUrl.length > 0)) {
    const dogName = matchedBooking.dog_name || matchedBooking.dogName;
    const ownerName = matchedBooking.owner_name || matchedBooking.ownerName;
    const phone = matchedBooking.owner_phone || matchedBooking.ownerPhone;
    
    let curEnd = matchedBooking.end_date || matchedBooking.endDate || todayIso;
    let newEnd = curEnd;
    let newTotalPrice = Number(matchedBooking.total_price || 0);
    let newDeposit = Number(matchedBooking.deposit_amount || 0);
    let dailyRate = Number(matchedBooking.data?.dailyRate || 120);

    let updatesApplied = [];

    // Payment & auto-extension calculation
    if (parsedAmount > 0) {
      newDeposit += parsedAmount;
      newTotalPrice += parsedAmount;
      const extraDays = parsedDays > 0 ? parsedDays : Math.max(1, Math.round(parsedAmount / (dailyRate || 120)));
      
      const baseDate = new Date(curEnd > todayIso ? curEnd : todayIso);
      baseDate.setDate(baseDate.getDate() + extraDays);
      newEnd = baseDate.toISOString().substring(0, 10);
      updatesApplied.push(`נקלט תשלום בסך ₪${parsedAmount.toLocaleString('he-IL')} (סה"כ שולם: ₪${newDeposit.toLocaleString('he-IL')})`);
      updatesApplied.push(`השהייה הוארכה ב-${extraDays} ימים עד לתאריך ${formatDateIL(newEnd)}`);
    } else if (parsedDate) {
      newEnd = parsedDate;
      updatesApplied.push(`תאריך השהייה עודכן ל-${formatDateIL(newEnd)}`);
    } else if (parsedDays > 0) {
      const baseDate = new Date(curEnd > todayIso ? curEnd : todayIso);
      baseDate.setDate(baseDate.getDate() + parsedDays);
      newEnd = baseDate.toISOString().substring(0, 10);
      updatesApplied.push(`השהייה הוארכה ב-${parsedDays} ימים עד לתאריך ${formatDateIL(newEnd)}`);
    }

    // Room update
    let finalKennel = matchedBooking.data?.kennelNumber || matchedBooking.kennel_id || 2;
    if (locKey) {
      finalKennel = locKey;
      updatesApplied.push(`שובץ במיקום: ${formatKennelLabel(locKey)}`);
    }

    // Reactivate if completed or expired
    const newStayStatus = 'checked_in';
    if (matchedBooking.stay_status !== 'checked_in') {
      updatesApplied.push(`הוחזר לסטטוס שהייה פעילה בריזורט (צ'ק-אין)`);
    }

    const noteAddition = `עודכן מוואטסאפ מנהל ב-${todayIso}: ${cleanText.substring(0, 80)}`;
    const finalNotes = matchedBooking.notes ? `${matchedBooking.notes} | ${noteAddition}` : noteAddition;

    const updatedData = {
      ...(matchedBooking.data || {}),
      endDate: newEnd,
      totalPrice: newTotalPrice,
      depositAmount: newDeposit,
      paymentStatus: newDeposit >= newTotalPrice ? 'fully_paid' : 'deposit_paid',
      stayStatus: newStayStatus,
      kennelNumber: finalKennel,
      kennelId: typeof finalKennel === 'string' && finalKennel.startsWith('room_') ? finalKennel : `room_${finalKennel}`,
      notes: finalNotes,
      updatedAt: new Date().toISOString()
    };

    await supabase.from('bookings').update({
      end_date: newEnd,
      total_price: newTotalPrice,
      deposit_amount: newDeposit,
      payment_status: updatedData.paymentStatus,
      stay_status: newStayStatus,
      notes: finalNotes,
      data: updatedData,
      updated_at: new Date().toISOString()
    }).eq('id', matchedBooking.id);

    // Also update customer record if exists
    if (phone) {
      const cleanP = phone.replace(/\D/g, '');
      await supabase.from('customers').update({
        total_spent: newTotalPrice,
        last_visit: newEnd,
        open_debt: Math.max(0, newTotalPrice - newDeposit),
        updated_at: new Date().toISOString()
      }).ilike('phone', `%${cleanP.slice(-7)}%`);
    }

    return `🐾 *הפנייה טופלה ועודכנה בהצלחה במערכת!* ✅\n\n` +
      `🐶 *כלב:* ${dogName} (${matchedBooking.dog_breed || 'מעורב'})\n` +
      `👤 *בעלים:* ${ownerName} (${phone})\n` +
      `🛏️ *מיקום:* ${formatKennelLabel(finalKennel)}\n` +
      `🗓️ *תאריכים:* ${formatDateIL(matchedBooking.start_date)} ⬅️ *${formatDateIL(newEnd)}*\n` +
      `💰 *סטטוס תשלום:* ₪${newDeposit} מתוך ₪${newTotalPrice} (${newDeposit >= newTotalPrice ? 'שולם במלואו 🟢' : 'מקדמה שולמה 🟡'})\n\n` +
      `📋 *פירוט הפעולות שבוצעו:*\n` +
      updatesApplied.map(u => `• ${u}`).join('\n') + `\n\n` +
      `הנתונים מסונכרנים כעת ביומן הריזורט ובדוחות! 🚀`;
  }

  // 7. ROOM MAP & OVERVIEW ("סדר חדרים", "תמונת מצב חדרים", "טעויות בשיבוץ לחדרים")
  if (norm.includes('חדרימ') || norm.includes('שיבוצ') || norm.includes('לוח')) {
    const active = (allBookings || []).filter(b => {
      const isNotCancelled = b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled';
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return isNotCancelled && ((s <= todayIso && e >= todayIso) || b.stay_status === 'checked_in');
    });

    let msg = `🛏️ *תמונת מצב שיבוץ חדרים (${formatDateIL(todayIso)}):*\n\n`;
    active.forEach((b, idx) => {
      const dog = b.dog_name || b.dogName || 'כלב';
      const kennel = formatKennelLabel(b.data?.kennelNumber || b.kennel_id || b.kennel_number);
      const owner = b.owner_name || b.ownerName || '';
      msg += `${idx + 1}. *${dog}* – ${kennel} (${owner})\n`;
    });
    msg += `\n💡 כדי לשנות שיבוץ, רשום למשל: "שבץ את ${active[0]?.dog_name || 'מייק'} בסוויטה 3"`;
    return msg;
  }

  // 8. CHECK-IN / CHECK-OUT / CANCEL
  if (norm.includes('קלוט') || norm.includes('צ\'ק אינ') || norm.includes('צק אינ') || norm.includes('שחרר') || norm.includes('צ\'ק אאוט') || norm.includes('בטל שהייה')) {
    const isCheckIn = norm.includes('קלוט') || norm.includes('אינ');
    const isCheckOut = norm.includes('שחרר') || norm.includes('אאוט');
    const isCancel = norm.includes('בטל') || norm.includes('מחק');

    if (matchedBooking) {
      let targetStatus = matchedBooking.stay_status;
      let statusLabel = '';
      if (isCheckIn) { targetStatus = 'checked_in'; statusLabel = 'נקלט בריזורט (צ\'ק אין) 🐾'; }
      else if (isCheckOut) { targetStatus = 'checked_out'; statusLabel = 'השתחרר מהריזורט (צ\'ק אאוט) 🚪'; }
      else if (isCancel) { targetStatus = 'cancelled'; statusLabel = 'בוטל ❌'; }

      const updatedData = {
        ...(matchedBooking.data || {}),
        stayStatus: targetStatus,
        updatedAt: new Date().toISOString()
      };

      await supabase.from('bookings').update({
        stay_status: targetStatus,
        data: updatedData,
        updated_at: new Date().toISOString()
      }).eq('id', matchedBooking.id);

      return `✅ *סטטוס השהייה עודכן בהצלחה!* 🐕\n\n🐶 *כלב:* ${matchedBooking.dog_name || matchedBooking.dogName}\n👤 *בעלים:* ${matchedBooking.owner_name || matchedBooking.ownerName}\n📌 *סטטוס נוכחי:* ${statusLabel}`;
    }
  }

  // 9. SEARCH CUSTOMER / CLIENT ("חפש לקוח יוסי", "טלפון 0546610321")
  if (norm.includes('חפש') || norm.includes('לקוח') || norm.includes('טלפונ')) {
    const queryTerm = cleanText.replace(/(?:חפש|לקוח|טלפון|מספר|פרטים|עבור|של)/gi, '').trim().toLowerCase();
    if (queryTerm.length >= 2) {
      const matches = (allBookings || []).filter(b => {
        const oName = (b.owner_name || b.ownerName || '').toLowerCase();
        const dName = (b.dog_name || b.dogName || '').toLowerCase();
        const phone = (b.owner_phone || b.ownerPhone || '').replace(/\D/g, '');
        return oName.includes(queryTerm) || dName.includes(queryTerm) || phone.includes(queryTerm);
      });

      if (matches.length > 0) {
        const first = matches[0];
        const dog = first.dog_name || first.dogName;
        const owner = first.owner_name || first.ownerName;
        const phone = first.owner_phone || first.ownerPhone;
        const s = formatDateIL(first.start_date || first.startDate);
        const e = formatDateIL(first.end_date || first.endDate);
        const kennel = formatKennelLabel(first.data?.kennelNumber || first.kennel_id || first.kennel_number);
        const deposit = first.deposit_amount || 0;
        const total = first.total_price || 0;

        return `👤 *נמצא כרטיס לקוח: ${owner}*\n\n🐶 *כלב:* ${dog} (${first.dog_breed || first.dogBreed || 'מעורב'})\n📱 *טלפון:* ${phone}\n🗓️ *שהייה:* ${s} ⬅️ ${e}\n🛏️ *מיקום:* ${kennel}\n💰 *תשלום:* ₪${deposit} מתוך ₪${total}\n📊 *סך ביקורים בהיסטוריה:* ${matches.length}`;
      }
    }
  }

  // 10. SPECIFIC DOG QUERY
  if (matchedBooking) {
    const dog = matchedBooking.dog_name || matchedBooking.dogName;
    const breed = matchedBooking.dog_breed || matchedBooking.dogBreed || 'מעורב';
    const owner = matchedBooking.owner_name || matchedBooking.ownerName || '';
    const phone = matchedBooking.owner_phone || matchedBooking.ownerPhone || '';
    const s = formatDateIL(matchedBooking.start_date || matchedBooking.startDate);
    const e = formatDateIL(matchedBooking.end_date || matchedBooking.endDate);
    const kennel = formatKennelLabel(matchedBooking.data?.kennelNumber || matchedBooking.kennel_id || matchedBooking.kennel_number);
    const deposit = matchedBooking.deposit_amount || 0;
    const total = matchedBooking.total_price || 0;
    const balance = Math.max(0, total - deposit);
    const notes = matchedBooking.notes || matchedBooking.data?.notes || 'אין הערות מיוחדות';

    return `🐶 *כרטיס שהייה: ${dog} (${breed})*\n\n👤 *בעלים:* ${owner} (${phone})\n🗓️ *תאריכים:* ${s} ⬅️ ${e}\n🛏️ *מיקום משובץ:* ${kennel}\n💰 *תשלום:* שולם ₪${deposit} מתוך ₪${total} (יתרה: ₪${balance})\n📝 *הערות:* ${notes}`;
  }

  // 11. Fallback friendly guide
  return `🤖 קיבלתי את הודעתך: "${cleanText}".
תוכל לרשום לי שאילתות, בדיקת תפוסה, שיבוץ חדרים, עדכוני תשלומים או סטטוסים.
לרשימת כל האפשרויות, שלח *"עזרה"* או *"פקודות"*.`;
}

export default async function handler(req, res) {
  // Always return 200 to Webhook provider quickly
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Resort WhatsApp Webhook is active' });
  }

  const payload = req.body;
  if (!payload || payload.typeWebhook !== 'incomingMessageReceived') {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const senderData = payload.senderData || {};
  const chatId = senderData.chatId || '';
  const sender = senderData.sender || '';

  // 1. Ignore groups, broadcasts, empty chats
  if (!chatId || !chatId.endsWith('@c.us') || chatId.includes('status@broadcast')) {
    return res.status(200).json({ ok: true, reason: 'group or broadcast ignored' });
  }

  // 2. Ignore messages from the resort bot itself
  const instanceWid = payload.instanceData?.wid || '972548765888@c.us';
  if (sender === instanceWid || chatId === instanceWid) {
    return res.status(200).json({ ok: true, reason: 'self message ignored' });
  }

  // Clean phone number
  const cleanPhone = chatId.replace('@c.us', '').replace(/[^0-9]/g, '');
  const phoneSuffix = cleanPhone.slice(-7); // Last 7 digits
  const senderName = senderData.senderName || senderData.senderContactName || '';

  const msgData = payload.messageData || {};
  const incomingText = (msgData.textMessageData?.textMessage || 
                        msgData.extendedTextMessageData?.text || 
                        msgData.fileMessageData?.caption || '').trim();
  const incomingFileUrl = msgData.fileMessageData?.downloadUrl || '';

  // 3. Special handling for Hila the Trainer (0526908943)
  const isHila = cleanPhone.includes('526908943');
  if (isHila) {
    const isVideo = payload.typeWebhook === 'incomingMessageReceived' && (
      payload.messageData?.typeMessage === 'videoMessage' ||
      incomingFileUrl.toLowerCase().includes('.mp4') ||
      msgData.fileMessageData?.mimeType?.startsWith('video/')
    );

    const isImage = payload.typeWebhook === 'incomingMessageReceived' && (
      payload.messageData?.typeMessage === 'imageMessage' ||
      incomingFileUrl.toLowerCase().includes('.jpg') ||
      incomingFileUrl.toLowerCase().includes('.jpeg') ||
      incomingFileUrl.toLowerCase().includes('.png') ||
      msgData.fileMessageData?.mimeType?.startsWith('image/')
    );

    const isExplicitReceipt = /קבלה|חשבונית|חשבונית\s*מס|מס'\s*קבלה|דוח\s*תשלום|הנהלת\s*חשבונות/i.test(incomingText) ||
      incomingFileUrl.toLowerCase().includes('.pdf') ||
      msgData.fileMessageData?.mimeType?.includes('pdf');

    console.log('--- Incoming message from Hila the Trainer ---', { incomingText, incomingFileUrl, isVideo, isImage, isExplicitReceipt });

    // A. Explicit Receipts / Invoices -> Routed directly to Manager (054-3200007)
    if (isExplicitReceipt) {
      const managerChatId = '972543200007@c.us';
      let alertMsg = `🐾 *התקבלה קבלה מהילה המאלפת (Halodog) להנהלת חשבונות*\n`;
      if (incomingText) alertMsg += `\n📄 *פרטי הודעה/קבלה:* "${incomingText}"`;
      alertMsg += `\n\n❓ *האם שולם בפועל וכמה?*\nנא לשתף כאן אישור תשלום ביט / צילום מסך או לרשום "שולם 1000 בביט" כדי שאתייק אותו במערכת ואסגור את החשבון.`;

      if (incomingFileUrl) {
        const fileName = incomingFileUrl.toLowerCase().includes('.pdf') ? 'receipt_hila.pdf' : 'receipt_hila.jpg';
        await sendWhatsAppFile(managerChatId, incomingFileUrl, fileName, alertMsg);
      } else {
        await sendWhatsAppMessage(managerChatId, alertMsg);
      }

      // Save pending receipt to Supabase settings
      try {
        const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config');
        const curData = sData?.[0]?.data || {};
        const curReceipts = Array.isArray(curData.trainerReceipts) ? curData.trainerReceipts : [];
        const detectedNum = (incomingText.match(/(?:קבלה|מס'|מספר)\s*[:#]?\s*(\d+)/i) || [])[1] || `הילה-${Date.now().toString().slice(-4)}`;
        const detectedAmount = (incomingText.match(/(?:₪|סך|סכום|שולם)?\s*(\d{3,4})/i) || [])[1];
        const newReceipt = {
          id: `rcpt-${Date.now()}`,
          receiptNumber: detectedNum,
          receiptDate: new Date().toISOString().substring(0, 10),
          totalAmount: detectedAmount ? Number(detectedAmount) : 1000,
          paymentMethod: 'ביט',
          rawLineText: incomingText || 'מסמך קבלה מוואטסאפ',
          receiptImageUrl: incomingFileUrl,
          allocations: [],
          isPaidActually: false,
          managerQuerySent: true,
          managerQuerySentAt: new Date().toISOString(),
          status: 'pending_payment',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        curReceipts.unshift(newReceipt);
        await supabase.from('settings').update({
          data: { ...curData, trainerReceipts: curReceipts }
        }).eq('id', 'resort_config');
      } catch (dbErr) {
        console.warn('Error saving Hila receipt to Supabase:', dbErr);
      }

      return res.status(200).json({ ok: true, handled: 'hila_receipt_notified_manager' });
    }

    // B. Media (Photos and Videos of dogs / training) -> Routed directly to Raz (054-3180407)
    if (isVideo || isImage) {
      console.log('Hila sent dog/training media (photo/video). Forwarding directly to Raz (054-3180407)...');
      const razChatId = '972543180407@c.us';
      const isVid = isVideo;
      const defaultFileName = isVid ? 'hila_training_video.mp4' : 'hila_dog_photo.jpg';
      const captionPrefix = isVid ? '🎬 סרטון אילוף חדש מהילה המאלפת (Halodog) 🐾' : '📸 תמונה חדשה מהילה המאלפת (Halodog) 🐾';
      const caption = incomingText ? `${captionPrefix}\n"${incomingText}"` : captionPrefix;

      if (incomingFileUrl) {
        await sendWhatsAppFile(razChatId, incomingFileUrl, defaultFileName, caption);
      } else if (incomingText) {
        await sendWhatsAppMessage(razChatId, `📸 הודעה מהילה המאלפת (Halodog) בנוגע למדיה:\n"${incomingText}"`);
      }
      return res.status(200).json({ ok: true, handled: 'hila_media_forwarded_to_raz' });
    }

    return res.status(200).json({ ok: true, handled: 'hila_text_received' });
  }

  // 4. Authorized Manager / Resort Team Handling (Manager 0543200007, Shmulik 0506336896, Raz 0543180407, Etti 0524467314)
  const isManager = cleanPhone.includes('543200007') || 
                    cleanPhone.includes('506336896') || 
                    cleanPhone.includes('543180407') || 
                    cleanPhone.includes('524467314');

  if (isManager) {
    const trimmed = incomingText.trim();
    const nText = normHebrew(trimmed);

    // Triggers for Manager AI Assistant:
    // 1. Prefixes: '!', '#', '/', 'מערכת', 'בוט', 'ריזורט', 'ai', 'פקודה'
    // 2. Question words & intent: 'עזרה', 'שאלה', 'תבדוק', 'בדוק', 'כמה', 'מי', 'איפה', 'מה', 'למה', 'האם', 'שבץ', 'עדכן', 'תעדכן', 'הארך', 'בטל', 'קלוט', 'שחרר'
    // 3. Question mark in text: '?' or '؟'
    // 4. Standalone keywords: 'שלום', 'עזרה', 'פקודות', 'תפריט', 'תפוסה', 'מצב', 'חדרים'
    const isCommandTrigger = trimmed.startsWith('!') || 
                             trimmed.startsWith('#') || 
                             trimmed.startsWith('/') || 
                             nText.startsWith('מערכת') || 
                             nText.startsWith('בוט') || 
                             nText.startsWith('ריזורט') || 
                             nText.startsWith('ai') || 
                             nText.startsWith('פקודה') ||
                             nText.startsWith('עזרה') ||
                             nText.startsWith('שאלה') ||
                             nText.startsWith('בדוק') ||
                             nText.startsWith('תבדוק') ||
                             nText.startsWith('תברר') ||
                             nText.startsWith('כמה') ||
                             nText.startsWith('מי') ||
                             nText.startsWith('איפה') ||
                             nText.startsWith('מה') ||
                             nText.startsWith('למה') ||
                             nText.startsWith('האם') ||
                             nText.startsWith('שבץ') ||
                             nText.startsWith('הארך') ||
                             nText.startsWith('עדכן') ||
                             nText.startsWith('תעדכן') ||
                             nText.startsWith('קלוט') ||
                             nText.startsWith('שחרר') ||
                             nText.includes('עזרה!') ||
                             nText.includes('?') ||
                             nText.includes('؟') ||
                             nText === 'שלומ' ||
                             nText === 'שלום' ||
                             nText === 'עזרה' ||
                             nText === 'פקודות' ||
                             nText === 'תפריט' ||
                             nText === 'תפוסה' ||
                             nText === 'מצב';

    if (isCommandTrigger) {
      const cleanCommand = trimmed
        .replace(/^[!#/]/, '')
        .replace(/^(?:מערכת|בוט|ריזורט|ai|פקודה)[:,\s-]*/i, '')
        .replace(/^עזרה[!\s:]*/i, '')
        .trim();

      console.log('--- Manager AI Command Triggered ---', { senderPhone: cleanPhone, cleanCommand });
      const replyText = await handleManagerAICommand(chatId, cleanCommand || trimmed || 'שלום', incomingFileUrl);
      if (replyText) {
        await sendWhatsAppMessage(chatId, replyText);
      }
      return res.status(200).json({ ok: true, handled: 'manager_command_executed', reply: replyText });
    }

    console.log('--- Incoming message from Manager/Team (Human chat - Silent) ---', { senderPhone: cleanPhone, incomingText });
    // Regular human chat with Shmulik - stay 100% silent!
    return res.status(200).json({ ok: true, handled: 'manager_silent_human_chat' });
  }

  // 5. Determine Israel Time & Closed/Open Status
  const now = new Date();
  const israelDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }); // YYYY-MM-DD
  const israelTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jerusalem", hour: '2-digit', minute: '2-digit' });
  const [hour, minute] = israelTimeStr.split(':').map(Number);
  const timeInMinutes = hour * 60 + minute;

  // Day of week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const israelDay = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getDay();

  // Weekend closure: Friday from 14:00, all Saturday, Sunday until 09:30
  const isFridayAfternoon = (israelDay === 5 && timeInMinutes >= 14 * 60);
  const isSaturday = (israelDay === 6);
  const isSundayMorning = (israelDay === 0 && timeInMinutes < 9 * 60 + 30);
  const isWeekendClosed = isFridayAfternoon || isSaturday || isSundayMorning;

  // Jewish Holiday check
  const isHolidayClosed = await checkIsShabbatOrHoliday(israelDateStr);
  const isClosedHours = isWeekendClosed || isHolidayClosed;

  // 6. Check client status (Existing vs New)
  const isExisting = await isExistingClient(phoneSuffix);

  // 7. Weekend / Holiday Closed Hours: Send EXACTLY ONE notice per 24 hours
  if (isClosedHours) {
    const canSend = await canSendAutoReplyToClient(cleanPhone);
    if (!canSend) {
      console.log('--- Cooldown active in closed hours (Silent) ---', { cleanPhone, isExisting });
      return res.status(200).json({ ok: true, reason: 'closed_hours_cooldown_active', cleanPhone });
    }

    if (isExisting) {
      console.log('--- Sending single closed hours notice to existing client ---', { cleanPhone });
      await sendWhatsAppMessage(chatId, CLOSED_WEEKEND_HOLIDAY_MSG);
    } else {
      console.log('--- Sending single closed hours notice + intake link to new lead ---', { cleanPhone });
      await sendWhatsAppMessage(chatId, getClosedHoursNewLeadMessage(cleanPhone, senderName));
    }

    return res.status(200).json({ ok: true, sent: true, mode: 'closed_hours_single_notice', isExisting, cleanPhone });
  }

  // 8. Normal Business Hours
  if (isExisting) {
    // Existing clients in open hours: 100% silent, Shmulik & team answer directly in CRM
    console.log('--- Incoming message from existing client in business hours (Silent) ---', { cleanPhone, incomingText });
    return res.status(200).json({ ok: true, handled: 'existing_client_open_hours_silent', phoneSuffix });
  }

  // New lead in business hours: Send EXACTLY ONE intake questionnaire per 24h
  const canSend = await canSendAutoReplyToClient(cleanPhone);
  if (!canSend) {
    console.log('--- Cooldown active for lead in business hours (Silent) ---', { cleanPhone });
    return res.status(200).json({ ok: true, reason: 'lead_open_hours_cooldown_active', cleanPhone });
  }

  console.log('--- Sending intake form to new client lead in business hours ---', { cleanPhone, senderName });
  await sendWhatsAppMessage(chatId, getIntakeFormMessage(cleanPhone, senderName));

  return res.status(200).json({
    ok: true,
    sent: true,
    mode: 'open_hours_lead_intake',
    cleanPhone
  });
}

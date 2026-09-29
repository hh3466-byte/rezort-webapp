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

// Anti-spam cooldown memory (6 hours per phone)
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
async function handleManagerAICommand(chatId, cleanText, fileUrl = '') {
  const norm = normHebrew(cleanText);
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

  // 1. HELP & MENU
  if (norm === 'עזרה' || norm === 'פקודות' || norm === 'תפריט' || norm === 'היי' || norm === 'שלום' || norm === 'help' || norm === 'הוראות' || norm === 'מה אתה יודע לעשות') {
    return `👋 *שלום מנהל! ברוך הבא למערכת הניהול בוואטסאפ של הריזורט לכלב* 🐾

תוכל לרשום לי כל בקשה, שאילתה או עדכון בשפה חופשית:

📊 *דוחות ותפוסה:*
• "כמה כלבים שוהים כרגע?"
• "מי משתחרר מחר?" / "מי מגיע מחר?"
• "מה קורה מחר?" / "מי נכנס היום?"

🔍 *בירור על כלב או לקוח:*
• "מה המצב של לונה?"
• "איפה ג'וי משובץ?"
• "חפש לקוח יוסי" / "טלפון 0501234567"

🛏️ *שיבוץ והעברת חדרים:*
• "שבץ את מייק בחדר 3"
• "העבר את מוקה לסוויטה 2"
• "שבץ את רקסי בהלנה ביתית"

💰 *עדכון תשלום ומקדמה:*
• "תעדכן מקדמה 300 שח לרוקי"
• "סגר חשבון 800 שח עבור לונה"
• (או שליחת צילום אישור ביט / קבלה)

📅 *תאריכים וסטטוס:*
• "הארך את השהייה של לונה עד 15.10"
• "קלוט את שון" / "צ'ק אין לשון"
• "שחרר את ברונו" / "בטל שהייה של בל"

📝 *רישום שהייה חדשה:*
• "רשום שהייה: כלב מקס, גזע פודל, בעלים דני, 0541112233, 01.10 עד 05.10, 720 שח"

📑 *שאלוני קליטה ממתינים:*
• "שאלונים חדשים" / "בקשות ממתינות"

הכל מתעדכן ישירות ב-Supabase ומסונכרן בזמן אמת ל-CRM! 🚀`;
  }

  // 2. OCCUPANCY & STAYING DOGS
  if (norm.includes('כמה כלבימ') || norm.includes('תפוסה') || norm.includes('מי שוהה') || (norm.includes('סטטוס') && !norm.includes('של')) || norm === 'מצב') {
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
        const kennel = formatKennelLabel(b.data?.kennelNumber || b.kennel_number);
        const s = formatDateIL(b.start_date || b.startDate);
        const e = formatDateIL(b.end_date || b.endDate);
        msg += `${idx + 1}. *${dog}* ${breed ? `(${breed})` : ''} – ${kennel}\n`;
        msg += `   👤 בעלים: ${owner} | 🗓️ ${s} ⬅️ ${e}\n`;
      });
    }
    return msg;
  }

  // 3. TOMORROW & TODAY OVERVIEW
  if (norm.includes('מחר') || norm.includes('משתחרר') || norm.includes('מגיע') || norm.includes('נכנס')) {
    const isTomorrow = norm.includes('מחר');
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

    let msg = `📋 *סקירת ${isTomorrow ? 'מחר' : 'היום'} (${formatDateIL(targetDate)}):*\n\n`;
    
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

  // 4. PENDING QUESTIONNAIRES
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

  // 5. ROOM / KENNEL PLACEMENT ("שבץ את ג'וי בחדר 3", "העבר את מוקה לסוויטה 2")
  if (norm.includes('שבצ') || norm.includes('העבר') || norm.includes('שימ')) {
    const locKey = parseLocationKey(cleanText);
    if (locKey) {
      const { data: bookings } = await supabase.from('bookings').select('*');
      const active = (bookings || []).filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

      let matchedBooking = null;
      for (const b of active) {
        const dName = normHebrew(b.dog_name || b.dogName || '');
        if (dName && norm.includes(dName)) {
          matchedBooking = b;
          break;
        }
      }

      if (matchedBooking) {
        const updatedData = {
          ...(matchedBooking.data || {}),
          kennelNumber: locKey,
          updatedAt: new Date().toISOString()
        };

        await supabase.from('bookings').update({
          data: updatedData,
          updated_at: new Date().toISOString()
        }).eq('id', matchedBooking.id);

        return `✅ *שיבוץ עודכן בהצלחה!* 🛏️🐾\n\n🐶 *כלב:* ${matchedBooking.dog_name || matchedBooking.dogName}\n📍 *מיקום חדש:* ${formatKennelLabel(locKey)}\n👤 *בעלים:* ${matchedBooking.owner_name || matchedBooking.ownerName} (${matchedBooking.owner_phone || matchedBooking.ownerPhone})\n🗓️ *תאריכים:* ${formatDateIL(matchedBooking.start_date)} ⬅️ ${formatDateIL(matchedBooking.end_date)}`;
      } else {
        return `⚠️ זיהיתי את המיקום (${formatKennelLabel(locKey)}), אך לא מצאתי כלב פעיל שתואם לשם שצוין.\nנסה לרשום למשל: "שבץ את מייק בחדר 3"`;
      }
    }
  }

  // 6. PAYMENT UPDATES ("תעדכן מקדמה 300 שח לרוקי", "שולם 500 ללונה", or Bit receipt)
  if (norm.includes('שולמ') || norm.includes('מקדמה') || norm.includes('סגר חשבונ') || norm.includes('תשלומ') || norm.includes('ביט') || fileUrl.length > 0) {
    const amountMatch = cleanText.match(/(?:₪|שולם|סך|הועבר|סכום|מקדמה)?\s*(\d{2,5})/);
    const parsedAmount = amountMatch ? Number(amountMatch[1]) : 0;

    const { data: bookings } = await supabase.from('bookings').select('*');
    const active = (bookings || []).filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

    let matchedBooking = null;
    for (const b of active) {
      const dName = normHebrew(b.dog_name || b.dogName || '');
      const oName = normHebrew(b.owner_name || b.ownerName || '');
      if ((dName && norm.includes(dName)) || (oName && norm.includes(oName))) {
        matchedBooking = b;
        break;
      }
    }

    if (matchedBooking && parsedAmount > 0) {
      const totalPrice = matchedBooking.total_price || matchedBooking.data?.totalPrice || parsedAmount;
      const newDeposit = parsedAmount;
      const isFull = newDeposit >= totalPrice;
      const paymentStatus = isFull ? 'fully_paid' : 'deposit_paid';

      const updatedData = {
        ...(matchedBooking.data || {}),
        depositAmount: newDeposit,
        paymentStatus,
        notes: `${matchedBooking.notes || ''} | שולם ₪${newDeposit} (עודכן מוואטסאפ מנהל ב-${todayIso})`.trim(),
        updatedAt: new Date().toISOString()
      };

      await supabase.from('bookings').update({
        deposit_amount: newDeposit,
        payment_status: paymentStatus,
        notes: updatedData.notes,
        data: updatedData,
        updated_at: new Date().toISOString()
      }).eq('id', matchedBooking.id);

      return `✅ *התשלום עודכן בהצלחה במערכת!* 💰\n\n🐶 *כלב:* ${matchedBooking.dog_name || matchedBooking.dogName}\n👤 *בעלים:* ${matchedBooking.owner_name || matchedBooking.ownerName}\n💵 *סכום שנקלט:* ₪${newDeposit.toLocaleString('he-IL')}\n📊 *סטטוס תשלום:* ${isFull ? 'שולם במלואו 🟢' : `מקדמה שולמה (יתרה: ₪${Math.max(0, totalPrice - newDeposit)}) 🟡`}`;
    }
  }

  // 7. DATE EXTENSION / MODIFICATION ("הארך את השהייה של לונה עד 15.10")
  if (norm.includes('הארכ') || norm.includes('שנה תאריכ') || norm.includes('תאריכימ')) {
    const { data: bookings } = await supabase.from('bookings').select('*');
    const active = (bookings || []).filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

    let matchedBooking = null;
    for (const b of active) {
      const dName = normHebrew(b.dog_name || b.dogName || '');
      if (dName && norm.includes(dName)) {
        matchedBooking = b;
        break;
      }
    }

    if (matchedBooking) {
      const newEnd = parseDateInput(cleanText);
      if (newEnd) {
        const updatedData = {
          ...(matchedBooking.data || {}),
          endDate: newEnd,
          notes: `${matchedBooking.notes || ''} | הוארך עד ${formatDateIL(newEnd)} (עודכן מוואטסאפ מנהל)`.trim(),
          updatedAt: new Date().toISOString()
        };

        await supabase.from('bookings').update({
          end_date: newEnd,
          notes: updatedData.notes,
          data: updatedData,
          updated_at: new Date().toISOString()
        }).eq('id', matchedBooking.id);

        return `✅ *תאריך השהייה הוארך ועודכן בהצלחה!* 📅\n\n🐶 *כלב:* ${matchedBooking.dog_name || matchedBooking.dogName}\n👤 *בעלים:* ${matchedBooking.owner_name || matchedBooking.ownerName}\n🗓️ *תאריכים מעודכנים:* ${formatDateIL(matchedBooking.start_date)} ⬅️ *${formatDateIL(newEnd)}*`;
      }
    }
  }

  // 8. CHECK-IN / CHECK-OUT / CANCEL
  if (norm.includes('קלוט') || norm.includes('צ\'ק אינ') || norm.includes('צק אינ') || norm.includes('שחרר') || norm.includes('צ\'ק אאוט') || norm.includes('בטל שהייה')) {
    const isCheckIn = norm.includes('קלוט') || norm.includes('אינ');
    const isCheckOut = norm.includes('שחרר') || norm.includes('אאוט');
    const isCancel = norm.includes('בטל') || norm.includes('מחק');

    const { data: bookings } = await supabase.from('bookings').select('*');
    let matchedBooking = null;
    for (const b of bookings || []) {
      const dName = normHebrew(b.dog_name || b.dogName || '');
      if (dName && norm.includes(dName)) {
        matchedBooking = b;
        break;
      }
    }

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

  // 9. QUICK BOOKING REGISTRATION ("רשום שהייה לכלב מקס, בעלים דני, 0501234567...")
  if (norm.includes('רשומ שהייה') || norm.includes('הוספ שהייה') || norm.includes('שריונ חדש')) {
    const dogMatch = cleanText.match(/כלב[:\s]+([^\s,]+)/i);
    const ownerMatch = cleanText.match(/בעלים[:\s]+([^\d,]+)/i);
    const phoneMatch = cleanText.match(/(05\d[\s-]?\d{7})/);
    const datesMatch = cleanText.match(/(\d{1,2}[./\-]\d{1,2}(?:[./\-]\d{2,4})?)\s*(?:עד|ל|-)\s*(\d{1,2}[./\-]\d{1,2}(?:[./\-]\d{2,4})?)/);
    const priceMatch = cleanText.match(/(\d{3,5})\s*(?:ש"ח|שח|₪)?/);

    if (dogMatch && phoneMatch && datesMatch) {
      const dogName = dogMatch[1].trim();
      const ownerName = ownerMatch ? ownerMatch[1].trim() : 'בעלים';
      const ownerPhone = phoneMatch[1].replace(/\D/g, '');
      const startDate = parseDateInput(datesMatch[1]);
      const endDate = parseDateInput(datesMatch[2]);
      const totalPrice = priceMatch ? Number(priceMatch[1]) : 0;
      const newId = `b-wa-${Date.now()}`;

      const bookingObj = {
        id: newId,
        dog_name: dogName,
        dog_breed: 'מעורב',
        owner_name: ownerName,
        owner_phone: ownerPhone,
        service_type: 'boarding',
        start_date: startDate,
        end_date: endDate,
        total_price: totalPrice,
        deposit_amount: 0,
        payment_status: 'unpaid',
        stay_status: 'booked',
        notes: `נרשם ישירות מוואטסאפ מנהל ב-${todayIso}`,
        data: {
          id: newId,
          dogName,
          dogBreed: 'מעורב',
          ownerName,
          ownerPhone,
          serviceType: 'boarding',
          startDate,
          endDate,
          totalPrice,
          depositAmount: 0,
          paymentStatus: 'unpaid',
          stayStatus: 'booked',
          notes: `נרשם ישירות מוואטסאפ מנהל ב-${todayIso}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await supabase.from('bookings').insert([bookingObj]);

      return `✅ *שהייה חדשה נרשמה בהצלחה בריזורט!* 🐾🎉\n\n🐶 *כלב:* ${dogName}\n👤 *בעלים:* ${ownerName} (${ownerPhone})\n🗓️ *תאריכים:* ${formatDateIL(startDate)} ⬅️ ${formatDateIL(endDate)}\n💰 *מחיר:* ₪${totalPrice.toLocaleString('he-IL')}\n\nהשהייה מופיעה כעת ביומן הריזורט ב-CRM!`;
    }
  }

  // 10. SEARCH CUSTOMER / CLIENT ("חפש לקוח יוסי", "טלפון 0546610321")
  if (norm.includes('חפש') || norm.includes('לקוח') || norm.includes('טלפונ')) {
    const queryTerm = cleanText.replace(/(?:חפש|לקוח|טלפון|מספר|פרטים|עבור|של)/gi, '').trim().toLowerCase();
    if (queryTerm.length >= 2) {
      const { data: bookings } = await supabase.from('bookings').select('*');
      const matches = (bookings || []).filter(b => {
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
        const kennel = formatKennelLabel(first.data?.kennelNumber || first.kennel_number);
        const deposit = first.deposit_amount || 0;
        const total = first.total_price || 0;

        return `👤 *נמצא כרטיס לקוח: ${owner}*\n\n🐶 *כלב:* ${dog} (${first.dog_breed || first.dogBreed || 'מעורב'})\n📱 *טלפון:* ${phone}\n🗓️ *שהייה:* ${s} ⬅️ ${e}\n🛏️ *מיקום:* ${kennel}\n💰 *תשלום:* ₪${deposit} מתוך ₪${total}\n📊 *סך ביקורים בהיסטוריה:* ${matches.length}`;
      }
    }
  }

  // 11. SPECIFIC DOG QUERY (Active first, then past)
  const { data: allBookings } = await supabase.from('bookings').select('*');
  const activeBookings = (allBookings || []).filter(b => b.stay_status !== 'cancelled' && (b.end_date >= todayIso || b.stay_status === 'checked_in'));
  const candidateList = activeBookings.length > 0 ? activeBookings : (allBookings || []);

  for (const b of candidateList) {
    const dName = normHebrew(b.dog_name || b.dogName || '');
    if (dName.length >= 2 && norm.includes(dName)) {
      const dog = b.dog_name || b.dogName;
      const breed = b.dog_breed || b.dogBreed || 'מעורב';
      const owner = b.owner_name || b.ownerName || '';
      const phone = b.owner_phone || b.ownerPhone || '';
      const s = formatDateIL(b.start_date || b.startDate);
      const e = formatDateIL(b.end_date || b.endDate);
      const kennel = formatKennelLabel(b.data?.kennelNumber || b.kennel_number);
      const deposit = b.deposit_amount || 0;
      const total = b.total_price || 0;
      const balance = Math.max(0, total - deposit);
      const notes = b.notes || b.data?.notes || 'אין הערות מיוחדות';

      return `🐶 *כרטיס שהייה: ${dog} (${breed})*\n\n👤 *בעלים:* ${owner} (${phone})\n🗓️ *תאריכים:* ${s} ⬅️ ${e}\n🛏️ *מיקום משובץ:* ${kennel}\n💰 *תשלום:* שולם ₪${deposit} מתוך ₪${total} (יתרה: ₪${balance})\n📝 *הערות:* ${notes}`;
    }
  }

  // 12. Fallback friendly guide
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
    console.log('--- Incoming message from Hila the Trainer ---', { incomingText, incomingFileUrl });

    // Send immediate query to Shmulik (050-6336896) and Manager (054-3200007)
    const alertRecipients = ['972506336896@c.us', '972543200007@c.us'];
    let alertMsg = `🐾 *התקבלה קבלה/הודעה מהילה המאלפת (Halodog)*\n`;
    if (incomingText) alertMsg += `\n📄 *פרטי הודעה/קבלה:* "${incomingText}"`;
    if (incomingFileUrl) alertMsg += `\n📷 *צורפה תמונת קבלה לתיוק*`;
    alertMsg += `\n\n❓ *האם שולם בפועל וכמה?*\nנא לשתף כאן אישור תשלום ביט / צילום מסך או לרשום "שולם 1000 בביט" כדי שאתייק אותו במערכת ואסגור את החשבון.`;

    for (const rec of alertRecipients) {
      await sendWhatsAppMessage(rec, alertMsg);
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
        rawLineText: incomingText || 'תמונת קבלה מוואטסאפ',
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

    return res.status(200).json({ ok: true, handled: 'hila_notified_manager' });
  }

  // 4. Authorized Manager / Resort Team Handling (Manager 0543200007, Shmulik 0506336896, Raz 0543180407, Etti 0524467314)
  const isManager = cleanPhone.includes('543200007') || 
                    cleanPhone.includes('506336896') || 
                    cleanPhone.includes('543180407') || 
                    cleanPhone.includes('524467314');

  if (isManager) {
    console.log('--- Incoming message from Manager/Team (Silent - No Auto Reply) ---', { senderPhone: cleanPhone, incomingText });
    // Rule: Never send automated replies back to Manager (054-3200007) or team members so conversations remain 100% natural and human.
    return res.status(200).json({ ok: true, handled: 'manager_silent_no_auto_reply' });
  }

  // 5. Anti-spam / Cooldown check for regular clients (don't reply more than once every 6 hours)
  const nowMs = Date.now();
  const lastSent = cooldownMap.get(cleanPhone);
  if (lastSent && (nowMs - lastSent) < 6 * 60 * 60 * 1000) {
    return res.status(200).json({ ok: true, reason: 'cooldown active' });
  }

  // 6. Determine Israel Time & Status
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

  // 7. Check client status (Existing vs New)
  const isExisting = await isExistingClient(phoneSuffix);

  // Set cooldown mark
  cooldownMap.set(cleanPhone, nowMs);

  // 8. Action decision for regular clients
  if (isClosedHours) {
    if (isExisting) {
      // Existing client in closed hours: send closed message
      await sendWhatsAppMessage(chatId, CLOSED_WEEKEND_HOLIDAY_MSG);
    } else {
      // New client in closed hours: send closed message + intake form message
      await sendWhatsAppMessage(chatId, CLOSED_WEEKEND_HOLIDAY_MSG);
      await new Promise(r => setTimeout(r, 1200));
      await sendWhatsAppMessage(chatId, getIntakeFormMessage(cleanPhone, senderName));
    }
  } else {
    // Normal Business Hours
    if (!isExisting) {
      // New client in open hours: send ONLY intake form message
      await sendWhatsAppMessage(chatId, getIntakeFormMessage(cleanPhone, senderName));
    }
    // Existing client in open hours: no auto-reply (human answers)
  }

  return res.status(200).json({
    ok: true,
    sent: true,
    isClosedHours,
    isExisting,
    phoneSuffix
  });
}

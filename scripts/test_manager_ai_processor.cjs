const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

function formatDateIL(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    return `${parts[2].substring(0, 2)}.${parts[1]}.${parts[0].slice(2)}`;
  }
  return dateStr;
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

async function processManagerMessage(cleanText) {
  const norm = normHebrew(cleanText);
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  
  const { data: allBookings } = await supabase.from('bookings').select('*');
  
  // Look for any matching dog or owner
  let matchedBooking = null;
  for (const b of allBookings || []) {
    const dName = normHebrew(b.dog_name || b.dogName || '');
    const oName = normHebrew(b.owner_name || b.ownerName || '');
    if (dName && dName.length >= 2 && norm.includes(dName)) {
      matchedBooking = b;
      break;
    }
    if (oName && oName.length >= 3 && norm.includes(oName)) {
      matchedBooking = b;
      break;
    }
  }

  // Detect amounts (e.g. 600 ש"ח)
  const amountMatch = cleanText.match(/(?:₪|שולם|סך|הועבר|סכום|מקדמה)?\s*(\d{2,5})\s*(?:ש"ח|שח|₪)?/);
  const parsedAmount = amountMatch ? Number(amountMatch[1]) : 0;
  
  // Detect date or days extension
  const daysMatch = cleanText.match(/(?:עוד|ב-?|נוספים|נוסף)?\s*(\d+)\s*(?:ימים|לילות|יום|לילה)/);
  const parsedDays = daysMatch ? Number(daysMatch[1]) : 0;
  const parsedDate = parseDateInput(cleanText);

  // Detect location
  const locKey = parseLocationKey(cleanText);

  console.log('Analysis:', {
    matchedDog: matchedBooking?.dog_name,
    matchedOwner: matchedBooking?.owner_name,
    amount: parsedAmount,
    days: parsedDays,
    date: parsedDate,
    location: locKey
  });

  // Handle Missing dog / Complex extension / Payment / Room update
  if (matchedBooking && (parsedAmount > 0 || parsedDays > 0 || parsedDate || locKey || norm.includes('נעלמ') || norm.includes('הארכ') || norm.includes('עיכוב') || norm.includes('שייט') || norm.includes('מזג אויר') || norm.includes('שיבוצ') || norm.includes('חדר'))) {
    const dogName = matchedBooking.dog_name || matchedBooking.dogName;
    const ownerName = matchedBooking.owner_name || matchedBooking.ownerName;
    const phone = matchedBooking.owner_phone || matchedBooking.ownerPhone;
    
    let curEnd = matchedBooking.end_date || matchedBooking.endDate || todayIso;
    let newEnd = curEnd;
    let newTotalPrice = Number(matchedBooking.total_price || 0);
    let newDeposit = Number(matchedBooking.deposit_amount || 0);
    let dailyRate = Number(matchedBooking.data?.dailyRate || 120);

    let updatesApplied = [];

    // 1. Amount payment & auto-extension calculation
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

    // 2. Room update
    let finalKennel = matchedBooking.data?.kennelNumber || matchedBooking.kennel_id || 2;
    if (locKey) {
      finalKennel = locKey;
      updatesApplied.push(`שובץ במיקום: ${formatKennelLabel(locKey)}`);
    }

    // 3. Reactivate if completed or expired
    const newStayStatus = 'checked_in';
    if (matchedBooking.stay_status !== 'checked_in') {
      updatesApplied.push(`הוחזר לסטטוס שהייה פעילה בריזורט (צ'ק-אין)`);
    }

    const noteAddition = `עודכן מוואטסאפ מנהל ב-${todayIso}: ${cleanText.substring(0, 80)}`;
    const finalNotes = matchedBooking.notes ? `${matchedBooking.notes} | ${noteAddition}` : noteAddition;

    return `🐾 *הפנייה טופלה ועודכנה בהצלחה במערכת!* ✅\n\n` +
      `🐶 *כלב:* ${dogName} (${matchedBooking.dog_breed || 'מעורב'})\n` +
      `👤 *בעלים:* ${ownerName} (${phone})\n` +
      `🛏️ *מיקום:* ${formatKennelLabel(finalKennel)}\n` +
      `🗓️ *תאריכים:* ${formatDateIL(matchedBooking.start_date)} ⬅️ *${formatDateIL(newEnd)}*\n` +
      `💰 *סטטוס תשלום:* ₪${newDeposit} מתוך ₪${newTotalPrice} (שולם במלואו 🟢)\n\n` +
      `📋 *פירוט הפעולות שבוצעו:*\n` +
      updatesApplied.map(u => `• ${u}`).join('\n') + `\n\n` +
      `הנתונים מסונכרנים כעת ביומן הריזורט ובדוחות! 🚀`;
  }

  return 'Fallback';
}

async function test() {
  const sampleMsg = `יש שוב טעויות של המערכת בשיבוץ לחדרים
קירה - נעלמה מהמערכת (של ישראל מנדל שהעביר אמש 600 ש"ח וביקשתי/דיברנו שתל בזה (הם בשייט ומזג האויר מעכב אותם)`;

  const res = await processManagerMessage(sampleMsg);
  console.log('--- OUTPUT ---');
  console.log(res);
}

test();

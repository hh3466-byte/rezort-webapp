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

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
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

async function main() {
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;

  console.log('Fetching Green-API outgoing messages in the last 480 mins (8 hours)...');
  const res = await fetch(`https://api.green-api.com/waInstance${greenId}/lastOutgoingMessages/${greenToken}?minutes=480`);
  const outgoing = await res.json();

  console.log(`\n=== הודעות יוצאות ב-8 השעות האחרונות (${Array.isArray(outgoing) ? outgoing.length : 0} הודעות) ===`);
  if (Array.isArray(outgoing)) {
    outgoing.forEach(m => {
      const time = new Date((m.timestamp || 0) * 1000).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || '';
      console.log(`[${time}] ל: ${m.chatId} | ${text.slice(0, 100)}...`);
    });
  }

  // Check dogs staying tonight in bookings
  const todayStr = '2026-09-23';
  const tomorrowStr = '2026-09-24';
  const { data: bookings } = await supabase.from('bookings').select('*');
  const activeBookings = (bookings || []).filter(b => (b.stay_status || b.stayStatus) !== 'cancelled');

  const stayingTonight = activeBookings.filter(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    return start <= todayStr && end > todayStr;
  });

  console.log(`\n=== כלבים השוהים הלילה בריזורט (${stayingTonight.length} כלבים) ===`);
  stayingTonight.forEach((b, idx) => {
    const dog = b.dog_name || b.dogName;
    const owner = b.owner_name || b.ownerName;
    const phone = b.owner_phone || b.ownerPhone;
    console.log(`${idx + 1}. 🐾 *${dog}* (${owner} - ${phone})`);
  });

  // Check tomorrow arrivals and departures (19:00 report)
  const tomorrowArrivals = activeBookings.filter(b => (b.start_date || b.startDate) === tomorrowStr);
  const tomorrowDepartures = activeBookings.filter(b => (b.end_date || b.endDate) === tomorrowStr);
  const tomorrowStaying = activeBookings.filter(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    return start <= tomorrowStr && end > tomorrowStr && start !== tomorrowStr;
  });

  console.log(`\n=== נתוני מחר (${tomorrowStr}) ===`);
  console.log(`כניסות מחר (${tomorrowArrivals.length}):`, tomorrowArrivals.map(b => b.dog_name || b.dogName).join(', '));
  console.log(`יציאות מחר (${tomorrowDepartures.length}):`, tomorrowDepartures.map(b => b.dog_name || b.dogName).join(', '));
  console.log(`ממשיכים לשהות (${tomorrowStaying.length}):`, tomorrowStaying.map(b => b.dog_name || b.dogName).join(', '));
}

main();

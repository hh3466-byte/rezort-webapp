const fs = require('fs');
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

async function checkRooms() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const todayStr = '2026-10-04';
  const tomorrowStr = '2026-10-05';

  const active = (bookings || []).filter(b => {
    const raw = b.data || {};
    const start = b.start_date || raw.startDate;
    const end = b.end_date || raw.endDate;
    const status = b.stay_status || raw.stayStatus;
    return status !== 'cancelled' && start <= tomorrowStr && end >= tomorrowStr;
  });

  console.log(`=== DOGS STAYING TOMORROW (${active.length}) ===`);
  active.forEach(b => {
    const raw = b.data || {};
    const kCol = b.kennel_number;
    const kData = raw.kennelNumber;
    const kAny = kCol || kData;
    console.log(`🐶 ${b.dog_name || raw.dogName} (${b.owner_name || raw.ownerName}) | חדר בעמודה: "${kCol}" | חדר ב-data: "${kData}" | סופי: "${kAny || 'ללא שיבוץ'}"`);
  });

  console.log('\n=== ALL BOOKINGS WITH KENNEL ASSIGNMENTS IN DB ===');
  bookings.filter(b => b.kennel_number || b.data?.kennelNumber).forEach(b => {
    const raw = b.data || {};
    console.log(`🐶 ${b.dog_name || raw.dogName} (${b.start_date || raw.startDate} -> ${b.end_date || raw.endDate}): ${b.kennel_number || raw.kennelNumber}`);
  });
}

checkRooms();

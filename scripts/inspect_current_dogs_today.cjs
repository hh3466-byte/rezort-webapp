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

async function checkSent() {
  const today = '2026-10-12';
  const { data: bookings } = await supabase.from('bookings').select('*');
  const activeToday = (bookings || []).filter(b => {
    const s = b.stay_status || (b.data && b.data.stayStatus);
    const start = b.start_date || (b.data && b.data.startDate);
    const end = b.end_date || (b.data && b.data.endDate);
    if (s === 'cancelled' || s === 'archived' || s === 'checked_out') return false;
    return start <= today && end >= today;
  });

  console.log('--- ALL ACTIVE TODAY DOGS (' + activeToday.length + ') ---');
  for (const b of activeToday) {
    const sent = b.last_daily_dog_update_sent || (b.data && b.data.lastDailyDogUpdateSent);
    console.log(`Dog: ${b.dog_name} | Owner: ${b.owner_name} | Phone: ${b.owner_phone} | Dates: ${b.start_date} -> ${b.end_date} | Status: ${b.stay_status} | lastSent: ${sent}`);
  }
}

checkSent().catch(console.error);

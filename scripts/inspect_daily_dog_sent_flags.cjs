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

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const todayStr = '2026-09-26';

  const stayingToday = bookings.filter(b => {
    const raw = b.data || b;
    return (b.stay_status || raw.stayStatus) !== 'cancelled' &&
           (b.start_date || raw.startDate) <= todayStr &&
           (b.end_date || raw.endDate) >= todayStr;
  });

  console.log(`Checking lastDailyDogUpdateSent on ${stayingToday.length} active staying dogs:`);
  stayingToday.forEach(b => {
    const raw = b.data || {};
    console.log({
      dog: b.dog_name,
      owner: b.owner_name,
      phone: b.owner_phone,
      lastDailyDogUpdateSent: raw.lastDailyDogUpdateSent || b.last_daily_dog_update_sent,
      notes: b.notes
    });
  });
}

run();

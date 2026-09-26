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
  console.log('--- ALL BOOKINGS FOR VENUS (ונוס) ---');
  const { data: venusBookings, error: err1 } = await supabase
    .from('bookings')
    .select('*')
    .ilike('dog_name', '%ונוס%');
  console.log('Venus bookings:', JSON.stringify(venusBookings, null, 2), err1);

  console.log('\n--- ALL BOOKINGS FOR THEO (תיאו / תיאן) ---');
  const { data: theoBookings, error: err2 } = await supabase
    .from('bookings')
    .select('*')
    .or('dog_name.ilike.%תיאו%,dog_name.ilike.%תיאן%');
  console.log('Theo bookings:', JSON.stringify(theoBookings, null, 2), err2);

  console.log('\n--- ALL BOOKINGS AROUND TODAY (September 2026) ---');
  const { data: sepBookings, error: err3 } = await supabase
    .from('bookings')
    .select('id, dog_name, owner_name, owner_phone, start_date, end_date, stay_status, is_active, updated_at, created_at')
    .gte('end_date', '2026-09-20')
    .lte('start_date', '2026-09-30');
  console.log('Sep 20-30 bookings count:', sepBookings?.length, err3);
  console.table(sepBookings);

  console.log('\n--- CHECK RECENT DB LOGS / AUDIT / SETTINGS / INTAKES ---');
  const { data: intakes } = await supabase
    .from('intakes')
    .select('*')
    .or('dog_name.ilike.%ונוס%,dog_name.ilike.%תיאו%,owner_name.ilike.%קובי%,owner_name.ilike.%שקל%');
  console.log('Matching intakes:', JSON.stringify(intakes, null, 2));
}

run();

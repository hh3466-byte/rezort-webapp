const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function markSent() {
  const today = '2026-09-15';
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .lte('start_date', today)
    .gt('end_date', today)
    .neq('stay_status', 'cancelled');

  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  console.log(`Marking ${bookings.length} bookings as daily update sent for ${today}...`);
  for (const b of bookings) {
    const data = b.data || {};
    data.lastDailyDogUpdateSent = today;
    const { error: upErr } = await supabase
      .from('bookings')
      .update({ data: data })
      .eq('id', b.id);

    if (upErr) {
      console.error(`Error updating ${b.dog_name}:`, upErr);
    } else {
      console.log(`✓ Marked ${b.dog_name} (${b.owner_name}) as sent for ${today}`);
    }
  }
}

markSent();

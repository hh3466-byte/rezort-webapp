const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const tom = '2026-09-19';
  const active = bookings.filter(b => b.stay_status !== 'cancelled');
  const incoming = active.filter(b => b.start_date === tom);
  const departing = active.filter(b => b.end_date === tom);
  const overnight = active.filter(b => b.start_date <= tom && b.end_date > tom);
  const daytime = active.filter(b => b.start_date <= tom && b.end_date >= tom);

  console.log('--- TOMORROW 2026-09-19 ---');
  console.log('Incoming:', incoming.length);
  incoming.forEach(b => console.log('  IN:', b.dog_name, b.service_type));
  console.log('Departing:', departing.length);
  departing.forEach(b => console.log('  OUT:', b.dog_name, b.service_type));
  console.log('Overnight:', overnight.length);
  overnight.forEach(b => console.log('  STAY:', b.dog_name, b.service_type));
  console.log('Daytime:', daytime.length);
  daytime.forEach(b => console.log('  DAY:', b.dog_name, b.service_type));
}

run();

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

async function checkTomorrow() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const active = bookings.filter(b => b.stay_status !== 'cancelled');
  const tomorrow = '2026-09-20';
  
  const incoming = active.filter(b => b.start_date === tomorrow);
  const departing = active.filter(b => b.end_date === tomorrow);
  const staying = active.filter(b => b.start_date <= tomorrow && b.end_date > tomorrow);

  console.log('Incoming tomorrow (20.09):', incoming.map(b => `${b.dog_name} (${b.owner_name})`));
  console.log('Departing tomorrow (20.09):', departing.map(b => `${b.dog_name} (${b.owner_name})`));
  console.log('Staying tomorrow (20.09):', staying.length, staying.map(b => b.dog_name));
}

checkTomorrow();

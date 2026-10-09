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
  const todayStr = '2026-10-06';
  const { data: sRow } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const settings = (sRow && sRow.data) || {};
  const intakes = settings.intakeRequests || [];
  const { data: bookings } = await supabase.from('bookings').select('*');

  console.log(`Total intakes in settings: ${intakes.length}`);

  intakes.forEach(r => {
    console.log(`Intake ID: ${r.id}, Dog: ${r.dogName}, Owner: ${r.ownerName}, Dates: ${r.startDate} to ${r.endDate}, Status: ${r.status}`);
  });
}

run();

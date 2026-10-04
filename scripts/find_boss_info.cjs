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
  const { data: intake } = await supabase.from('intake_requests').select('*');

  console.log('--- Searching in Bookings ---');
  const bMatches = (bookings || []).filter(b => {
    const s = JSON.stringify(b);
    return s.includes('בוס') || s.includes('Boss') || s.includes('boss');
  });
  console.log(`Found ${bMatches.length} in bookings:`);
  bMatches.forEach(b => console.log(JSON.stringify(b, null, 2)));

  console.log('\n--- Searching in Intake Requests ---');
  const iMatches = (intake || []).filter(i => {
    const s = JSON.stringify(i);
    return s.includes('בוס') || s.includes('Boss') || s.includes('boss');
  });
  console.log(`Found ${iMatches.length} in intake_requests:`);
  iMatches.forEach(i => console.log(JSON.stringify(i, null, 2)));
}

run().catch(console.error);

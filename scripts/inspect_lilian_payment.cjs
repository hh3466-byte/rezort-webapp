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
  const { data: p } = await supabase.from('grow_incoming_payments').select('*').eq('id', 'grow_4947561974').single();
  console.log('Payment record:', JSON.stringify(p, null, 2));

  const { data: b } = await supabase.from('bookings').select('*').ilike('owner_phone', '%526340385%');
  console.log('Bookings for phone:', JSON.stringify(b, null, 2));

  const { data: bName } = await supabase.from('bookings').select('*').ilike('owner_name', '%ליליאן%');
  console.log('Bookings for name:', JSON.stringify(bName, null, 2));

  const { data: intakes } = await supabase.from('intake_requests').select('*').ilike('owner_phone', '%526340385%');
  console.log('Intakes for phone:', JSON.stringify(intakes, null, 2));

  const { data: allIntakes } = await supabase.from('intake_requests').select('*').ilike('owner_name', '%ליליאן%');
  console.log('Intakes for name:', JSON.stringify(allIntakes, null, 2));
}

run();

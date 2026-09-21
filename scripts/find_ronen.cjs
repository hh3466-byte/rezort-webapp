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
  console.log('--- Checking bookings for Ronen Malamud ---');
  const { data: b1, error: bErr } = await supabase
    .from('bookings')
    .select('id, dog_name, owner_name, owner_phone, total_price, deposit_amount, payment_status, start_date, end_date')
    .or('owner_phone.ilike.%4728843%,owner_name.ilike.%רונן%');
  console.log('Bookings for Ronen:', b1, 'Error:', bErr);

  console.log('\n--- Checking resort_settings for Intake requests ---');
  const { data: s, error: sErr } = await supabase
    .from('resort_settings')
    .select('data')
    .eq('id', 'global_settings')
    .single();
  
  const ir = s?.data?.intakeRequests || [];
  console.log('Total intake requests in settings:', ir.length);
  const ronenIr = ir.filter(r => (r.ownerPhone && r.ownerPhone.includes('4728843')) || (r.ownerName && r.ownerName.includes('רונן')));
  console.log('Intake for Ronen:', ronenIr);
}

run();

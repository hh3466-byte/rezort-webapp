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
  console.log('=== 1. Checking Ronen Malamud booking ===');
  const { data: ronenBookings } = await supabase.from('bookings').select('*').ilike('dog_name', '%לונה%');
  ronenBookings?.forEach(b => console.log(JSON.stringify(b, null, 2)));

  console.log('\n=== 2. Checking all training bookings ===');
  const { data: trainingBookings } = await supabase.from('bookings').select('*').in('service_type', ['training', 'day_training', 'combined']);
  trainingBookings?.forEach(b => {
    console.log(`- Dog: ${b.dog_name} | Owner: ${b.owner_name} | Phone: ${b.owner_phone} | Dates: ${b.start_date} to ${b.end_date} | Total: ₪${b.total_price} | Deposit: ₪${b.deposit_amount} | Status: ${b.payment_status} | Notes: ${b.notes}`);
  });

  console.log('\n=== 3. Checking Grow manual payments metadata ===');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*').in('id', ['grow_manual_ronen_4500_1789507655837', 'grow_manual_ronen_2000_1789507655834', 'grow_4900844785']);
  growPayments?.forEach(p => console.log(JSON.stringify(p, null, 2)));
}

run();

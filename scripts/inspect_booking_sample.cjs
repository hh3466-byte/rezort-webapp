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
  const { data: bookings } = await supabase.from('bookings').select('*').neq('stay_status', 'cancelled');
  
  const dates = ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'];
  for (const d of dates) {
    const inc = bookings.filter(b => b.start_date === d);
    const out = bookings.filter(b => b.end_date === d);
    const present = bookings.filter(b => b.start_date <= d && b.end_date >= d);
    console.log(`\nDate: ${d}: Present=${present.length}, Incoming=${inc.length}, Departing=${out.length}`);
    if (inc.length) {
      console.log('  Incoming:');
      inc.forEach(b => console.log(`   - ${b.dog_name} (${b.owner_name}, ${b.owner_phone}) Total: ${b.total_price}, Paid: ${b.deposit_amount}, Type: ${b.service_type}`));
    }
    if (out.length) {
      console.log('  Departing:');
      out.forEach(b => console.log(`   - ${b.dog_name} (${b.owner_name}, ${b.owner_phone}) Total: ${b.total_price}, Paid: ${b.deposit_amount}, Type: ${b.service_type}`));
    }
  }
}
run();

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

async function inspectBookings() {
  const { data: bList, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }
  console.log(`Total rows in bookings: ${bList.length}`);
  bList.forEach(b => {
    const d = b.data || {};
    console.log(`ID: ${b.id} | Dog: ${b.dog_name || d.dogName} | Owner: ${b.owner_name || d.ownerName} | Dates: ${b.start_date || d.startDate} -> ${b.end_date || d.endDate} | Room: "${d.room || b.room_id || ''}" | Status: ${b.stay_status || d.stayStatus || b.status || d.status} | Price: ${b.total_price || d.totalPrice} | Dep: ${b.deposit_amount || d.depositAmount}`);
  });
}

inspectBookings().catch(console.error);

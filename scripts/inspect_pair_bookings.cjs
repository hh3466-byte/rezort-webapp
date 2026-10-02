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

async function check() {
  const { data: list } = await supabase.from('bookings').select('*').or('dog_name.ilike.%סקובי%,dog_name.ilike.%ג%ינגס%,dog_name.ilike.%גינגס%,dog_name.ilike.%לולה%,dog_name.ilike.%ברנדי%');
  for (const b of (list || [])) {
    console.log({
      id: b.id,
      dog_name: b.dog_name,
      owner_name: b.owner_name,
      owner_phone: b.owner_phone,
      start_date: b.start_date,
      end_date: b.end_date,
      total_price: b.total_price,
      deposit_amount: b.deposit_amount,
      payment_status: b.payment_status,
      stay_status: b.stay_status,
      isFreeStay: b.data?.isFreeStay,
      linkedDogName: b.data?.linkedDogName,
      notes: b.notes
    });
  }
}
check();

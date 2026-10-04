const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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
  const allRika = bookings.filter(b => JSON.stringify(b).includes('ריקה') || JSON.stringify(b).includes('ג\'סי'));
  console.log('All Rika bookings in DB:');
  allRika.forEach(b => {
    console.log({
      id: b.id,
      dog: b.dog_name,
      owner: b.owner_name,
      phone: b.owner_phone,
      dates: `${b.start_date} to ${b.end_date}`,
      stay_status: b.stay_status,
      total_price: b.total_price,
      deposit_amount: b.deposit_amount,
      payment_status: b.payment_status,
      notes: b.notes
    });
  });
}

run();

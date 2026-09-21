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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkJohnny() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const found = bookings.filter(b => {
    const s = JSON.stringify(b);
    return s.includes('ג\'וני') || s.includes('גוני') || s.includes('נרדית') || s.includes('אוניל');
  });
  console.log('Bookings found:', found.length);
  found.forEach(b => console.log(b.id, b.dog_name, b.owner_name, b.start_date, b.end_date, b.stay_status, b.total_price, b.deposit_amount));
}

checkJohnny();

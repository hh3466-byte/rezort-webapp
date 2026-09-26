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
  const { data: allBookings, error } = await supabase
    .from('bookings')
    .select('id, dog_name, owner_name, owner_phone, start_date, end_date, total_price, deposit_amount, payment_status, stay_status, notes, updated_at');
  
  console.log(`Total bookings in DB: ${allBookings?.length}`);
  
  console.log('\n--- ALL CURRENT SEPTEMBER 2026 BOOKINGS ---');
  const sep = allBookings?.filter(b => (b.start_date <= '2026-09-30' && b.end_date >= '2026-09-01'));
  console.table(sep.map(b => ({
    id: b.id,
    dog: b.dog_name,
    owner: b.owner_name,
    phone: b.owner_phone,
    start: b.start_date,
    end: b.end_date,
    stay_status: b.stay_status,
    notes: (b.notes || '').slice(0, 30)
  })));

  console.log('\n--- SEARCHING FOR ANY RECORD WITH VENUS OR ELI KOBI ---');
  const v = allBookings?.filter(b => 
    (b.dog_name && b.dog_name.includes('ונוס')) || 
    (b.owner_name && b.owner_name.includes('אלי')) ||
    (b.owner_name && b.owner_name.includes('קובי')) ||
    (b.owner_phone && b.owner_phone.includes('6160220')) ||
    (b.id && b.id.includes('173090500'))
  );
  console.log('Venus records:', v);

  console.log('\n--- SEARCHING FOR ANY RECORD WITH THEO OR EYAL / HADAS SHEKEL ---');
  const t = allBookings?.filter(b => 
    (b.dog_name && (b.dog_name.includes('תיאו') || b.dog_name.includes('תיאן'))) || 
    (b.owner_name && b.owner_name.includes('שקל')) ||
    (b.owner_phone && (b.owner_phone.includes('5564073') || b.owner_phone.includes('5670355')))
  );
  console.log('Theo records:', t);
}

check();

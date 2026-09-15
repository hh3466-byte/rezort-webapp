const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function find() {
  const { data: bData, error: bErr } = await supabase.from('bookings').select('*');
  const matchingBookings = (bData || []).filter(b => 
    (b.dog_name && b.dog_name.includes('מיני')) || 
    (b.owner_name && b.owner_name.includes('תום'))
  );
  console.log('Bookings matching Tom / Mini Rose:', matchingBookings.length);
  matchingBookings.forEach(b => console.log('Booking:', {
    id: b.id,
    dog_name: b.dog_name,
    owner_name: b.owner_name,
    owner_phone: b.owner_phone,
    total_price: b.total_price,
    deposit_amount: b.deposit_amount,
    stay_status: b.stay_status,
    notes: b.notes,
    data: b.data
  }));

  const { data: iData, error: iErr } = await supabase.from('intake_requests').select('*');
  const matchingIntakes = (iData || []).filter(i => 
    (i.dog_name && i.dog_name.includes('מיני')) || 
    (i.owner_name && i.owner_name.includes('תום'))
  );
  console.log('\nIntakes matching Tom / Mini Rose:', matchingIntakes.length);
  matchingIntakes.forEach(i => console.log('Intake:', {
    id: i.id,
    dog_name: i.dog_name,
    owner_name: i.owner_name,
    owner_phone: i.owner_phone,
    status: i.status,
    internal_notes: i.internal_notes,
    calculated_price: i.calculated_price
  }));
}

find();

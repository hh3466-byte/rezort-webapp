const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = {};
fs.readFileSync('.env', 'utf-8').split('\n').forEach(line => {
  const p = line.split('=');
  if (p.length >= 2) env[p[0].trim()] = p.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
});

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: bookings } = await sb.from('bookings').select('*');
  const remBooking = bookings.filter(b => {
    const dog = (b.dog_name || b.dogName || '').toLowerCase();
    const phone = b.owner_phone || b.ownerPhone || '';
    return dog.includes('rem') || phone.includes('6241957');
  });
  console.log('Rem booking:', remBooking.map(b => ({
    id: b.id,
    dog: b.dog_name || b.dogName,
    owner: b.owner_name || b.ownerName,
    start: b.start_date || b.startDate,
    end: b.end_date || b.endDate,
    status: b.stay_status || b.stayStatus
  })));

  const rayBooking = bookings.filter(b => {
    const dog = (b.dog_name || b.dogName || '').toLowerCase();
    const phone = b.owner_phone || b.ownerPhone || '';
    return dog.includes('ריי') || phone.includes('3993810');
  });
  console.log('Ray booking:', rayBooking.map(b => ({
    id: b.id,
    dog: b.dog_name || b.dogName,
    owner: b.owner_name || b.ownerName,
    start: b.start_date || b.startDate,
    end: b.end_date || b.endDate,
    status: b.stay_status || b.stayStatus
  })));
}
run();

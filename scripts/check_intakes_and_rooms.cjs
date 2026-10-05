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
  const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  const intakes = sData?.data?.intakeRequests || [];
  
  const pendingIntakes = intakes.filter(i => i.status !== 'approved' && i.status !== 'archived' && i.status !== 'rejected');
  console.log('=== PENDING INTAKES (' + pendingIntakes.length + ') ===');
  pendingIntakes.forEach(i => {
    console.log({ id: i.id, dog: i.dogName, owner: i.ownerName, status: i.status, start: i.startDate, end: i.endDate });
  });

  const { data: bookings } = await supabase.from('bookings').select('*');
  const todayStr = '2026-10-04';
  const tomorrowStr = '2026-10-05';

  const tomBookings = bookings.filter(b => {
    const d = b.data || {};
    const start = b.start_date || d.startDate;
    const end = b.end_date || d.endDate;
    const status = b.stay_status || d.stayStatus;
    return status !== 'cancelled' && start <= tomorrowStr && end >= tomorrowStr;
  });

  console.log('\n=== TOMORROW BOOKINGS & ROOMS (' + tomBookings.length + ') ===');
  tomBookings.forEach(b => {
    const d = b.data || {};
    console.log({
      id: b.id,
      dog: b.dog_name || d.dogName,
      owner: b.owner_name || d.ownerName,
      dates: (b.start_date || d.startDate) + ' -> ' + (b.end_date || d.endDate),
      kennel_db: b.kennel,
      kennel_data: d.kennel,
      room_id: b.room_id
    });
  });
}

check();

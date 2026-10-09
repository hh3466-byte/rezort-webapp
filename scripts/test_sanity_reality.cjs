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
  const todayStr = '2026-10-06';
  const nowMs = Date.now();
  const past24HoursMs = nowMs - 24 * 60 * 60 * 1000;

  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: sRow } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const settings = (sRow && sRow.data) || {};
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  console.log('Bookings count:', bookings?.length);
  console.log('Intakes count:', intakes?.length);
  console.log('Grow payments count:', growPayments?.length);

  // Check bookings updated or created in past 24 hours
  const recentBookings = (bookings || []).filter(b => {
    if ((b.stay_status || b.stayStatus) === 'cancelled') return false;
    const up = b.updated_at || b.updatedAt || b.created_at;
    if (!up) return false;
    return new Date(up).getTime() >= past24HoursMs;
  });

  console.log('\n--- Bookings in past 24 hours ---');
  recentBookings.forEach(b => {
    console.log(`Dog: ${b.dog_name || b.dogName}, Owner: ${b.owner_name || b.ownerName}, Dates: ${b.start_date} to ${b.end_date}, Total: ${b.total_price}, Dep: ${b.deposit_amount}, Status: ${b.payment_status}, StayStatus: ${b.stay_status}`);
  });

  // Check open unhandled intakes whose dates are future
  const unhandledIntakes = (intakes || []).filter(r => {
    const st = r.status;
    if (st === 'approved' || st === 'rejected' || st === 'archived' || st === 'abandoned') return false;
    const rStart = r.startDate || r.start_date || '';
    const rEnd = r.endDate || r.end_date || '';
    if ((rEnd && rEnd < todayStr) || (rStart && rStart < todayStr)) return false;

    const rDog = (r.dogName || r.dog_name || '').trim().toLowerCase();
    const rPhone = (r.ownerPhone || r.owner_phone || '').replace(/\D/g, '');
    const hasBooking = (bookings || []).some(b => {
      if ((b.stay_status || b.stayStatus) === 'cancelled') return false;
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = (b.owner_phone || b.ownerPhone || '').replace(/\D/g, '');
      return (rDog && bDog && rDog === bDog && (bPhone.slice(-7) === rPhone.slice(-7) || !rPhone));
    });
    return !hasBooking;
  });

  console.log('\n--- Future unhandled intakes ---');
  unhandledIntakes.forEach(r => {
    console.log(`Intake: ${r.dog_name || r.dogName}, Owner: ${r.owner_name || r.ownerName}, Dates: ${r.start_date || r.startDate} to ${r.end_date || r.endDate}, Status: ${r.status}`);
  });
}

run();

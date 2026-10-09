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

async function inspect() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }
  console.log('Total bookings in Supabase:', bookings.length);

  const flagged = ['0524728843', '0545670355', '0523669361', '0556646093', '0542211442', '0524577752', '0527777787'];

  const matched = bookings.filter(b => {
    const phone = b.owner_phone || b.ownerPhone || b.data?.ownerPhone || '';
    return flagged.some(f => phone.includes(f));
  });

  console.log(`Found ${matched.length} matched bookings:`);
  matched.forEach(b => {
    const d = b.data || {};
    console.log({
      id: b.id,
      dog_name: b.dog_name || b.dogName || d.dogName,
      owner_name: b.owner_name || b.ownerName || d.ownerName,
      owner_phone: b.owner_phone || b.ownerPhone || d.ownerPhone,
      start_date: b.start_date || b.startDate || d.startDate,
      end_date: b.end_date || b.endDate || d.endDate,
      stay_status: b.stay_status || b.stayStatus || d.stayStatus,
      total_price: b.total_price ?? b.totalPrice ?? d.totalPrice,
      deposit_amount: b.deposit_amount ?? b.depositAmount ?? d.depositAmount,
      payment_status: b.payment_status || b.paymentStatus || d.paymentStatus,
      is_free_stay: b.is_free_stay ?? b.isFreeStay ?? d.isFreeStay,
      notes: b.notes || d.notes
    });
  });

  // Let's also check all checked_out bookings in general
  const checkedOut = bookings.filter(b => (b.stay_status || b.stayStatus || b.data?.stayStatus) === 'checked_out');
  console.log(`Total checked_out bookings: ${checkedOut.length}`);

  // Let's also check all past bookings (end_date < today)
  const today = '2026-10-08';
  const pastBookings = bookings.filter(b => (b.end_date || b.endDate || b.data?.endDate) < today);
  console.log(`Total past bookings (end_date < today): ${pastBookings.length}`);
}

inspect();

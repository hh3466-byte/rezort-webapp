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

async function diagnoseAll() {
  console.log('=== 1. FETCHING STAYS FROM SUPABASE ===');
  const { data: stays, error: sErr } = await supabase.from('stays').select('*');
  if (sErr) console.error('Stays fetch error:', sErr);
  console.log(`Total stays in DB: ${stays?.length || 0}`);

  const activeStays = (stays || []).filter(st => {
    const d = st.data || {};
    return d.status === 'confirmed' || d.status === 'active' || d.status === 'staying' || d.status === 'checked_in';
  });
  console.log(`Active/Confirmed stays: ${activeStays.length}`);
  activeStays.forEach(st => {
    const d = st.data || {};
    console.log(`[${st.id}] Dog: ${d.dogName} | Owner: ${d.ownerName} (${d.ownerPhone}) | Dates: ${d.startDate} -> ${d.endDate} | Room: "${d.room}" | Status: ${d.status} | Price: ${d.totalPrice} | Deposit: ${d.depositAmount} | PaidStatus: ${d.paymentStatus} | Notes: ${d.notes || ''}`);
  });

  console.log('\n=== 2. FETCHING BOOKINGS FROM SUPABASE ===');
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  if (bErr) console.error('Bookings fetch error:', bErr);
  console.log(`Total bookings in DB: ${bookings?.length || 0}`);
  const activeBookings = (bookings || []).filter(b => b.status === 'confirmed' || b.status === 'active');
  console.log(`Active bookings: ${activeBookings.length}`);
  activeBookings.forEach(b => {
    console.log(`[${b.id}] Dog: ${b.dog_name} | Owner: ${b.owner_name} | Dates: ${b.start_date} -> ${b.end_date} | Room: "${b.room_id || b.room}" | Status: ${b.status} | Price: ${b.total_price}`);
  });

  console.log('\n=== 3. FETCHING SETTINGS & ROOMS ===');
  const { data: settings } = await supabase.from('settings').select('*');
  const sData = settings?.[0]?.data || {};
  console.log('Settings rooms assignment if any:', JSON.stringify(sData.roomAssignments || sData.rooms || {}, null, 2));
}

diagnoseAll().catch(console.error);

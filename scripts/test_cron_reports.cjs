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

async function testReports() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settings } = await supabase.from('settings').select('*');
  const sData = settings?.[0]?.data || {};

  console.log(`=== Total Bookings in DB: ${bookings.length} ===\n`);

  const todayStr = '2026-10-02';
  const tomorrowStr = '2026-10-03';

  const activeBookings = bookings.filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

  const getPlacement = (b) => {
    const k = b.data?.kennelNumber ?? b.kennelNumber ?? b.kennel_number ?? b.room_id ?? b.data?.room;
    if (!k && k !== 0) return null;
    return String(k);
  };

  console.log('--- ALL STAYING DOGS TODAY (Checked in / Staying) ---');
  const stayingToday = activeBookings.filter(b => {
    const s = b.start_date || b.startDate;
    const e = b.end_date || b.endDate;
    const status = b.stay_status || b.stayStatus;
    return status === 'checked_in' || (s <= todayStr && e > todayStr && status !== 'booked');
  });

  stayingToday.forEach((b, idx) => {
    console.log(`${idx + 1}. Dog: ${b.dog_name || b.dogName} | Owner: ${b.owner_name || b.ownerName} | Room: "${getPlacement(b)}" | Dates: ${b.start_date} -> ${b.end_date} | Status: ${b.stay_status}`);
  });

  console.log(`\nTotal Staying Dogs Count: ${stayingToday.length}`);

  console.log('\n--- INCOMING DOGS TODAY (02.10.2026) ---');
  const incomingToday = activeBookings.filter(b => (b.start_date || b.startDate) === todayStr);
  incomingToday.forEach((b, idx) => {
    console.log(`${idx + 1}. Dog: ${b.dog_name || b.dogName} | Owner: ${b.owner_name || b.ownerName} | Dates: ${b.start_date} -> ${b.end_date} | Status: ${b.stay_status} | Price: ${b.total_price} | Dep: ${b.deposit_amount}`);
  });

  console.log('\n--- DEPARTING DOGS TODAY (02.10.2026) ---');
  const departingToday = activeBookings.filter(b => (b.end_date || b.endDate) === todayStr);
  departingToday.forEach((b, idx) => {
    console.log(`${idx + 1}. Dog: ${b.dog_name || b.dogName} | Owner: ${b.owner_name || b.ownerName} | Dates: ${b.start_date} -> ${b.end_date} | Status: ${b.stay_status}`);
  });
}

testReports().catch(console.error);

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

async function testFullEveningReportOutput() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settings } = await supabase.from('settings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const sData = settings?.[0]?.data || {};

  // Let's inspect what today's 19:00 report (for tomorrow Saturday 03.10) will look like:
  const todayStr = '2026-10-02';
  const tomorrowStr = '2026-10-03';

  const activeBookings = bookings.filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

  const deduplicateBookings = (list) => {
    const seen = new Set();
    return list.filter(b => {
      const phone = (b.owner_phone || b.ownerPhone || '').replace(/\D/g, '');
      const dog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const key = `${phone}_${dog}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const incomingDogs = deduplicateBookings(activeBookings.filter(b => (b.start_date || b.startDate) === tomorrowStr));
  const departingDogs = deduplicateBookings(activeBookings.filter(b => (b.end_date || b.endDate) === tomorrowStr));
  const endOfDayDogs = deduplicateBookings(activeBookings.filter(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    return start <= tomorrowStr && end > tomorrowStr;
  }));

  console.log(`Tomorrow (${tomorrowStr}):`);
  console.log(`Incoming dogs count: ${incomingDogs.length}`);
  console.log(`Departing dogs count: ${departingDogs.length}`);
  console.log(`End of day dogs count: ${endOfDayDogs.length}`);

  endOfDayDogs.forEach((d, idx) => {
    const k = d.data?.kennelNumber ?? d.kennelNumber ?? d.kennel_number ?? d.room_id ?? d.data?.room;
    console.log(`  ${idx+1}. ${d.dog_name} (${d.owner_name}) -> Room: "${k}"`);
  });
}

testFullEveningReportOutput().catch(console.error);

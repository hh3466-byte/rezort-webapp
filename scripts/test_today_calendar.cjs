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

function isBookingOnDate(b, dateStr) {
  if (b.stay_status === 'cancelled') return false;
  return dateStr >= b.start_date && dateStr <= b.end_date;
}

async function testToday() {
  const todayStr = '2026-09-25';
  const { data: allBookings } = await supabase.from('bookings').select('*');
  
  const todayBookings = allBookings.filter(b => isBookingOnDate(b, todayStr));
  console.log(`\n=== TODAY'S DOGS IN CALENDAR (${todayStr}) - TOTAL: ${todayBookings.length} ===`);
  todayBookings.forEach(b => {
    console.log(`- ${b.dog_name} (${b.owner_name}) | ${b.start_date} -> ${b.end_date} | שירות: ${b.service_type} | סטטוס: ${b.stay_status} | שולם: ₪${b.total_price}`);
  });

  const venus = todayBookings.find(b => b.dog_name.includes('ונוס'));
  const theo = todayBookings.find(b => b.dog_name.includes('תיאו'));
  
  console.log('\n--- VERIFICATION ---');
  console.log('Is Venus (ונוס) in today\'s calendar?', venus ? '✅ YES' : '❌ NO');
  console.log('Is Theo (תיאו) in today\'s calendar?', theo ? '✅ YES' : '❌ NO');
}

testToday();

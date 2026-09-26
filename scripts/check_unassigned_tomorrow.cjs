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

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*').neq('stay_status', 'cancelled');
  console.log('Total active bookings:', bookings.length);
  const tomorrowStr = '2026-09-25';
  const unassigned = bookings.filter(b => {
    const s = b.start_date || b.startDate;
    const e = b.end_date || b.endDate;
    const isStayingOrIncoming = (s <= tomorrowStr && e >= tomorrowStr) || s === tomorrowStr;
    const k = b.kennel_number !== undefined ? b.kennel_number : b.kennelNumber;
    return isStayingOrIncoming && (!k && k !== 0);
  });
  console.log('Unassigned dogs for tomorrow / staying:', unassigned.length);
  unassigned.forEach(b => {
    console.log(` - ${b.dog_name || b.dogName} (${b.owner_name || b.ownerName}) ${b.start_date} to ${b.end_date} | kennel: ${b.kennel_number}`);
  });
}

run();

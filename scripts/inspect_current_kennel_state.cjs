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
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*');

  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  console.log(`Total bookings in DB: ${bookings.length}`);

  const todayStr = '2026-09-26';
  const activeToday = bookings.filter(b => {
    const raw = b.data || b;
    const start = b.start_date || raw.startDate;
    const end = b.end_date || raw.endDate;
    const status = b.stay_status || raw.stayStatus;
    return status !== 'cancelled' && start <= todayStr && end >= todayStr;
  });

  console.log(`\nActive bookings on ${todayStr} (${activeToday.length} dogs):`);
  activeToday.forEach(b => {
    const raw = b.data || {};
    console.log({
      id: b.id,
      dogName: b.dog_name || raw.dogName,
      ownerName: b.owner_name || raw.ownerName,
      dates: `${b.start_date || raw.startDate} -> ${b.end_date || raw.endDate}`,
      stayStatus: b.stay_status || raw.stayStatus,
      serviceType: b.service_type || raw.serviceType,
      kennel_col: b.kennel_number,
      kennel_data: raw.kennelNumber,
      updated_at: b.updated_at
    });
  });

  console.log('\n--- SEARCH FOR THEO AND JESSIE ---');
  const theoAndJessie = bookings.filter(b => {
    const name = (b.dog_name || b.data?.dogName || '');
    return name.includes('תיאו') || name.includes('ג\'סי') || name.includes('גסי') || name.includes('Jessie') || name.includes('Theo');
  });

  theoAndJessie.forEach(b => {
    console.log(JSON.stringify(b, null, 2));
  });
}

run();

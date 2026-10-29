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
  console.log('--- Querying bookings for ניצה ---');
  const { data: nitzaBookings, error: err1 } = await supabase
    .from('bookings')
    .select('*')
    .ilike('dog_name', '%ניצה%');
  
  if (err1) console.error(err1);
  else {
    console.log(`Found ${nitzaBookings.length} bookings for ניצה:`);
    nitzaBookings.forEach(b => {
      console.log(`ID: ${b.id}, Dog: ${b.dog_name}, Owner: ${b.owner_name}, Phone: ${b.owner_phone}, Dates: ${b.start_date} to ${b.end_date}, Status: ${b.stay_status}, LastSent: ${b.data?.lastDailyDogUpdateSent}`);
      if (b.data?.additionalDailyGreetingRecipients) {
        console.log('Additional recipients:', JSON.stringify(b.data.additionalDailyGreetingRecipients));
      }
    });
  }

  console.log('\n--- Querying bookings with Hagai phone 0543200007 ---');
  const { data: hagaiBookings } = await supabase
    .from('bookings')
    .select('*')
    .ilike('owner_phone', '%3200007%');
  
  console.log(`Found ${hagaiBookings?.length || 0} bookings with Hagai phone:`);
  hagaiBookings?.forEach(b => {
    console.log(`ID: ${b.id}, Dog: ${b.dog_name}, Owner: ${b.owner_name}, Phone: ${b.owner_phone}, Dates: ${b.start_date} to ${b.end_date}, Status: ${b.stay_status}`);
  });

  console.log('\n--- Active bookings around 2026-10-17 / 2026-10-18 (or recent) ---');
  // Let's check latest bookings created or updated
  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('id, dog_name, owner_name, owner_phone, start_date, end_date, stay_status, updated_at, data')
    .order('updated_at', { ascending: false })
    .limit(20);

  console.log(`Recent updated bookings:`);
  recentBookings?.forEach(b => {
    console.log(`${b.dog_name} (${b.owner_name}) | ${b.start_date} -> ${b.end_date} | status: ${b.stay_status} | updated: ${b.updated_at} | lastSent: ${b.data?.lastDailyDogUpdateSent}`);
  });
}

run();

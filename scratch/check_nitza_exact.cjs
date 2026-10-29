const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:/Projects/הריזורט לכלב/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkNitza() {
  const { data: nitzaBookings } = await supabase
    .from('bookings')
    .select('*')
    .ilike('dog_name', '%ניצה%');

  console.log('Nitza bookings:');
  nitzaBookings.forEach(b => {
    console.log(`ID: ${b.id}`);
    console.log(`Dog: ${b.dog_name}, Owner: ${b.owner_name}, Phone: ${b.owner_phone}`);
    console.log(`Stay status: ${b.stay_status}, Dates: ${b.start_date} -> ${b.end_date}`);
    console.log(`Data:`, JSON.stringify(b.data));
  });
}

checkNitza().catch(console.error);

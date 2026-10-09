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

async function verifyAll9Dogs() {
  const todayStr = '2026-10-05';
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .lte('start_date', todayStr)
    .gt('end_date', todayStr)
    .neq('stay_status', 'cancelled');
    
  console.log(`Total active bookings today: ${bookings.length}`);
  bookings.forEach((b, i) => {
    console.log(`${i + 1}. כלב: ${b.dog_name}, בעלים: ${b.owner_name} (${b.owner_phone}) | סטטוס שליחה אחרונה: ${b.data?.lastDailyDogUpdateSent}`);
  });
}

verifyAll9Dogs().catch(console.error);

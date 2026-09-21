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

async function cross() {
  const today = '2026-09-17';
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .lte('start_date', today)
    .gt('end_date', today)
    .neq('stay_status', 'cancelled');

  const eveningMsgs = JSON.parse(fs.readFileSync('scripts/evening_msgs.json', 'utf8'));
  const sentPhones = new Set(eveningMsgs.map(m => m.chatId.replace(/\D/g, '').slice(-7)));

  console.log('=== Active Dogs Staying Tonight (' + today + ') ===');
  let sentCount = 0;
  let unsentCount = 0;

  bookings.forEach(b => {
    const clean = (b.owner_phone || '').replace(/\D/g, '').slice(-7);
    const wasSent = sentPhones.has(clean);
    if (wasSent) sentCount++; else unsentCount++;
    console.log(`${wasSent ? '✅ נשלח' : '❌ טרם נשלח'} | כלב: ${b.dog_name} | בעלים: ${b.owner_name} (${b.owner_phone}) | שירות: ${b.service_type}`);
  });

  console.log(`\nסיכום: ${sentCount} נשלחו בהצלחה, ${unsentCount} טרם נשלחו מתוך ${bookings.length} כלבים ששוהים הלילה.`);
}

cross().catch(console.error);

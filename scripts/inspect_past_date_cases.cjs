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

async function main() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log(`Total bookings in DB: ${bookings.length}`);

  // Look for bookings where notes or changes mention early arrival or extra day or discrepancy
  const interesting = bookings.filter(b => {
    const s = JSON.stringify(b);
    return s.includes('אקסטרא') || s.includes('הארכה') || s.includes('הקדם') || s.includes('הגיע') || s.includes('הפרש') || s.includes('טעות');
  });

  console.log(`Interesting bookings count: ${interesting.length}`);
  interesting.forEach(b => {
    console.log(`- [${b.id}] Dog: ${b.dog_name}, Owner: ${b.owner_name} (${b.start_date} to ${b.end_date}): ${b.notes}`);
  });
}

main().catch(console.error);

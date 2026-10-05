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

async function syncKennels() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log(`Checking ${bookings.length} bookings for kennel column synchronization...`);

  let count = 0;
  for (const b of bookings) {
    const raw = b.data || {};
    const k = raw.kennelNumber || raw.kennel || b.kennel_number;
    if (k && b.kennel_number !== k) {
      await supabase.from('bookings').update({ kennel_number: k }).eq('id', b.id);
      console.log(`Updated booking [${b.id}] ${b.dog_name || raw.dogName} -> kennel_number: ${k}`);
      count++;
    }
  }

  console.log(`\nFinished! Synchronized ${count} bookings with exact kennel placements.`);
}

syncKennels();

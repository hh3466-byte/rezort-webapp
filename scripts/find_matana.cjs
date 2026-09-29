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

async function listAllNames() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const allNames = new Set();
  (bookings || []).forEach(b => {
    const row = (b.data && typeof b.data === 'object') ? b.data : b;
    if (row.ownerName || row.owner_name) {
      allNames.add(`${row.ownerName || row.owner_name} (${row.dogName || row.dog_name}) - ${row.ownerPhone || row.owner_phone}`);
    }
  });
  (intakes || []).forEach(it => {
    const row = (it.data && typeof it.data === 'object') ? it.data : it;
    if (row.ownerName || row.owner_name) {
      allNames.add(`${row.ownerName || row.owner_name} (${row.dogName || row.dog_name}) - ${row.ownerPhone || row.owner_phone}`);
    }
  });
  console.log(`All ${allNames.size} unique client entries in DB:`);
  Array.from(allNames).sort().forEach((n, i) => console.log(`${i+1}. ${n}`));
}
listAllNames();

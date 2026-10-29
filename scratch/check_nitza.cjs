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
  const nitzaList = (bookings || []).filter(b => {
    const name = (b.dog_name || b.dogName || '').trim();
    return name.includes('ניצה');
  });
  console.log('Nitza bookings found:', nitzaList.length);
  nitzaList.forEach(b => {
    console.log({
      id: b.id,
      dog_name: b.dog_name,
      owner_name: b.owner_name,
      stay_status: b.stay_status,
      data_stay_status: b.data?.stayStatus,
      start_date: b.start_date,
      end_date: b.end_date,
      notes: b.notes
    });
  });
}

main();

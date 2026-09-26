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

async function inspectShlomi() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const matches = (bookings || []).filter(b => {
    const raw = JSON.stringify(b);
    return raw.includes('0505445512') || raw.includes('שלומי') || raw.includes('לונה');
  });

  console.log('Found', matches.length, 'bookings:');
  matches.forEach(b => {
    console.log({
      id: b.id,
      dog_name: b.dog_name || b.data?.dogName,
      owner_name: b.owner_name || b.data?.ownerName,
      phone: b.owner_phone || b.data?.ownerPhone,
      dog_gender: b.dog_gender,
      data_dogGender: b.data?.dogGender,
      service_type: b.service_type || b.data?.serviceType,
      start_date: b.start_date || b.data?.startDate,
      end_date: b.end_date || b.data?.endDate,
      stay_status: b.stay_status || b.data?.stayStatus
    });
  });
}

inspectShlomi();

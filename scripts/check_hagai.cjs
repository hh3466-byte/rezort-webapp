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

async function checkHagai() {
  const { data: reqs } = await supabase.from('intake_requests').select('*');
  const hagai = (reqs || []).filter(r => (r.owner_name && r.owner_name.includes('חגי')) || (r.owner_phone && r.owner_phone.includes('0543200007')));
  console.log('Hagai intake requests:', JSON.stringify(hagai, null, 2));

  const { data: bookings } = await supabase.from('bookings').select('*');
  const hagaiB = (bookings || []).filter(b => (b.owner_name && b.owner_name.includes('חגי')) || (b.owner_phone && b.owner_phone.includes('0543200007')));
  console.log('Hagai bookings:', JSON.stringify(hagaiB, null, 2));
}

checkHagai().catch(console.error);

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

async function check() {
  const { data: b } = await supabase.from('bookings').select('*').in('id', ['b-1789630883447', 'b-1789732108163', 'b-1789381914509']);
  console.log('Bookings:', JSON.stringify(b, null, 2));

  // Check intake requests
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const relevantIntakes = (intakes || []).filter(i => 
    (i.dog_name || '').includes('בוס') || 
    (i.dog_name || '').includes('יולי') ||
    (i.owner_name || '').includes('שרייבר') ||
    (i.owner_name || '').includes('אפיק') ||
    (i.owner_name || '').includes('אהרונסון')
  );
  console.log('Relevant Intakes:');
  relevantIntakes.forEach(i => console.log(i.id, i.dog_name, i.owner_name, i.owner_phone, i.start_date, i.end_date, i.status));
}

check();

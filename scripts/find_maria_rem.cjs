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

async function findMariaRem() {
  console.log('--- 1. Search Bookings ---');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const matchBookings = (bookings || []).filter(b => {
    const text = `${b.owner_name} ${b.dog_name} ${b.notes}`.toLowerCase();
    return text.includes('מרי') || text.includes('ראם') || text.includes('rem') || text.includes('ram');
  });
  console.log('Bookings matches:', JSON.stringify(matchBookings, null, 2));

  console.log('\n--- 2. Search Intake Requests ---');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const matchIntakes = (intakes || []).filter(i => {
    const text = `${i.owner_name} ${i.dog_name} ${i.notes}`.toLowerCase();
    return text.includes('מרי') || text.includes('ראם') || text.includes('rem') || text.includes('ram');
  });
  console.log('Intakes matches:', JSON.stringify(matchIntakes, null, 2));
}

findMariaRem().catch(console.error);

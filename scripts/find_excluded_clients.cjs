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

async function searchClients() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  console.log('--- Checking bookings for "מתנה" or "ברח" or lawsuit ---');
  (bookings || []).forEach(b => {
    const text = `${b.owner_name} ${b.dog_name} ${b.notes}`.toLowerCase();
    if (text.includes('מתנה') || text.includes('ברח') || text.includes('תביעה') || text.includes('משפט')) {
      console.log('Found booking:', { id: b.id, owner_name: b.owner_name, dog_name: b.dog_name, phone: b.owner_phone, notes: b.notes });
    }
  });

  console.log('\n--- Checking intakes for "מתנה" or "ברח" or lawsuit ---');
  (intakes || []).forEach(i => {
    const text = `${i.owner_name} ${i.dog_name} ${i.notes}`.toLowerCase();
    if (text.includes('מתנה') || text.includes('ברח') || text.includes('תביעה') || text.includes('משפט')) {
      console.log('Found intake:', { id: i.id, owner_name: i.owner_name, dog_name: i.dog_name, phone: i.owner_phone, notes: i.notes });
    }
  });

  console.log('\n--- All unique clients in bookings ---');
  const uniqueNames = new Set((bookings || []).map(b => `${b.owner_name} (${b.dog_name}) - ${b.owner_phone}`));
  console.log(Array.from(uniqueNames));
}

searchClients();

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

async function checkLuna() {
  console.log('=== Checking Luna Melamed in Bookings ===');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const lunaBookings = bookings.filter(b => {
    const d = b.data || b;
    const name = (b.dog_name || d.dogName || '') + ' ' + (b.owner_name || d.ownerName || '');
    return name.includes('מלמוד') || (name.includes('לונה') && (b.owner_name?.includes('רונן') || d.ownerName?.includes('רונן')));
  });
  console.log('Bookings found:', JSON.stringify(lunaBookings, null, 2));

  console.log('\n=== Checking Luna Melamed in Intake Requests ===');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const lunaIntakes = intakes.filter(i => {
    const name = (i.dog_name || i.dogName || '') + ' ' + (i.owner_name || i.ownerName || '');
    return name.includes('מלמוד') || (name.includes('לונה') && (i.owner_name?.includes('רונן') || i.ownerName?.includes('רונן')));
  });
  console.log('Intakes found:', JSON.stringify(lunaIntakes, null, 2));
}

checkLuna();

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

async function checkAllBookings() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log(`Found ${bookings.length} bookings total.`);

  console.log('\n--- Checking b-grow-* and single-day bookings that might be misplaced ---');
  const bGrow = bookings.filter(b => b.id.startsWith('b-grow-'));
  bGrow.forEach(b => {
    console.log(`ID: ${b.id} | Dog: ${b.dog_name} | Owner: ${b.owner_name} (${b.owner_phone}) | Dates: ${b.start_date} -> ${b.end_date} | Total: ${b.total_price} | Notes: ${b.notes}`);
  });

  console.log('\n--- Checking all September 2026 stays vs WhatsApp chat logs ---');
}

checkAllBookings();

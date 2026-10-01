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

async function inspect() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log(`Found ${bookings?.length} bookings.`);
  const sample = bookings?.find(b => JSON.stringify(b).includes('קארין'));
  console.log('Karin/Sean sample:', JSON.stringify(sample, null, 2));

  // Check columns on bookings table
  if (bookings && bookings.length > 0) {
    console.log('Columns on bookings:', Object.keys(bookings[0]));
  }
}

inspect();

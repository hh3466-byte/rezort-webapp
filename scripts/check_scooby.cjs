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

async function check() {
  const { data: bookings } = await supabase.from('bookings').select('*').ilike('dog_name', '%סקובי%');
  console.log('Bookings:', JSON.stringify(bookings, null, 2));

  // Let's also check resort_settings
  const { data: settings } = await supabase.from('resort_settings').select('*');
  if (settings && settings[0]) {
    const s = settings[0].data || {};
    const b = (s.bookings || []).find(x => (x.dogName || '').includes('סקובי'));
    console.log('Booking in resort_settings.data.bookings:', JSON.stringify(b, null, 2));
  }
}

check();

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
  const { data: settings } = await supabase.from('settings').select('*');
  console.log('=== SETTINGS ROW ===');
  console.log(JSON.stringify(settings, null, 2));

  const { data: intakes, error: errI } = await supabase.from('intake_requests').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('=== RECENT INTAKES ===');
  console.log(JSON.stringify(intakes, null, 2));

  const { data: recentBookings } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('=== RECENT BOOKINGS ===');
  console.log(JSON.stringify(recentBookings, null, 2));
}

main().catch(console.error);

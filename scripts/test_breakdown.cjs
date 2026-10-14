const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').trim().replace(/^['"]|['"]$/g, '');
});

const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: bks } = await s.from('bookings').select('*');
  const { data: growPayments } = await s.from('grow_incoming_payments').select('*');

  // Print all bookings for October and payments
  console.log('Bookings count:', bks.length);
  const leeBk = bks.find(b => b.owner_name && b.owner_name.includes('דלויה'));
  console.log('Lee booking:', JSON.stringify(leeBk, null, 2));
}

main().catch(console.error);

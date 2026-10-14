const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').trim().replace(/^['"]|['"]$/g, '');
});

const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: rows } = await s.from('grow_incoming_payments').select('*').ilike('customer_name', '%דלויה%');
  console.log('Lee Daluoya rows:', JSON.stringify(rows, null, 2));

  const { data: refRow } = await s.from('grow_incoming_payments').select('*').eq('reference_id', '4961553619');
  console.log('Ref 4961553619:', JSON.stringify(refRow, null, 2));

  const { data: bks } = await s.from('bookings').select('id, dog_name, owner_name, deposit_amount, total_price, payment_status, notes, data').ilike('owner_name', '%דלויה%');
  console.log('Bookings for Daluoya:', JSON.stringify(bks, null, 2));
}

main().catch(console.error);

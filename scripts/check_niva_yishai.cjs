const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').trim().replace(/^['"]|['"]$/g, '');
});

const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: nivaBks } = await s.from('bookings').select('id, dog_name, owner_name, deposit_amount, total_price, payment_status, notes').ilike('owner_name', '%ניבה%');
  console.log('Niva Bookings:', JSON.stringify(nivaBks, null, 2));

  const { data: yishaiBks } = await s.from('bookings').select('id, dog_name, owner_name, deposit_amount, total_price, payment_status, notes').ilike('owner_name', '%ישי%');
  console.log('Yishai Bookings:', JSON.stringify(yishaiBks, null, 2));
}

main().catch(console.error);

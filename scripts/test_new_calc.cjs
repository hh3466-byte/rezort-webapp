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

  console.log('--- Current October grow payments ---');
  const octGrow = growPayments.filter(p => (p.created_at || '').startsWith('2026-10') && p.status !== 'dismissed' && p.status !== 'refunded');
  octGrow.forEach(p => {
    console.log(`${p.id} | ${p.reference_id} | ${p.customer_name} | ₪${p.amount}`);
  });
}

main().catch(console.error);

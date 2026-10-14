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
  
  // Let's inspect active bookings in October
  console.log('Total bookings:', bks.length);
  console.log('Total growPayments:', growPayments.length);
  
  // October grow payments
  const octGrow = growPayments.filter(p => (p.created_at || '').startsWith('2026-10') && p.status !== 'dismissed' && p.status !== 'refunded');
  console.log('October grow payments in DB:');
  let sum = 0;
  octGrow.forEach(p => {
    console.log(`- ${p.created_at} | ref: ${p.reference_id} | ${p.customer_name} | ₪${p.amount}`);
    sum += Number(p.amount) || 0;
  });
  console.log('Sum octGrow:', sum);
}

main().catch(console.error);

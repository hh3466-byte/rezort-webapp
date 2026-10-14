const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').trim().replace(/^['"]|['"]$/g, '');
});

const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: bks } = await s.from('bookings').select('id, dog_name, owner_name, start_date, end_date, deposit_amount, total_price, payment_status, payment_method, notes');
  const octBks = bks.filter(b => (b.start_date <= '2026-10-31' && b.end_date >= '2026-10-01'));
  console.log(`October active bookings (${octBks.length}):`);
  octBks.forEach(b => {
    console.log(`- ${b.dog_name} (${b.owner_name}) | ${b.start_date} to ${b.end_date} | total: ₪${b.total_price} | deposit: ₪${b.deposit_amount} | ${b.payment_status} | method: ${b.payment_method} | notes: ${(b.notes||'').slice(0, 60)}`);
  });
}

main().catch(console.error);

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').trim().replace(/^['"]|['"]$/g, '');
});

const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: rows } = await s
    .from('grow_incoming_payments')
    .select('*')
    .gte('created_at', '2026-10-01T00:00:00Z')
    .lte('created_at', '2026-10-31T23:59:59Z')
    .order('created_at', { ascending: true });
  
  rows.forEach(r => {
    console.log(`${r.created_at} | ref: ${r.reference_id} | ${r.customer_name} | ₪${r.amount} | ${r.payment_method} | raw: ${(r.raw_email_snippet||'').slice(0, 70)}`);
  });
}

main().catch(console.error);

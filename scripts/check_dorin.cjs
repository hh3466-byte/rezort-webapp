const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').trim().replace(/^['"]|['"]$/g, '');
});

const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: rows } = await s.from('grow_incoming_payments').select('*').ilike('customer_name', '%דורין%');
  console.log('Dorin rows in grow_incoming_payments:', JSON.stringify(rows, null, 2));
}

main().catch(console.error);

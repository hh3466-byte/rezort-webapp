const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').trim().replace(/^['"]|['"]$/g, '');
});

const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: niva } = await s.from('grow_incoming_payments').select('*').ilike('customer_name', '%ניבה%');
  console.log('Niva payments:', JSON.stringify(niva, null, 2));

  const { data: yishai } = await s.from('grow_incoming_payments').select('*').ilike('customer_name', '%ישי%');
  console.log('Yishai payments:', JSON.stringify(yishai, null, 2));
}

main().catch(console.error);

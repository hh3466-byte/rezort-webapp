const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: all } = await supabase
    .from('grow_incoming_payments')
    .select('id, customer_name, amount, reference_id')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Recent payments in Supabase:', all);

  const { data: deleted, error } = await supabase
    .from('grow_incoming_payments')
    .delete()
    .or('customer_name.ilike.%כנען%,customer_name.ilike.%עפרה%')
    .select();
  console.log('Deleted payments:', deleted, 'error:', error);
}
run();

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
  const { error } = await supabase
    .from('grow_incoming_payments')
    .delete()
    .or('amount.lte.1,customer_name.eq.לקוח Grow,customer_name.eq.מה נדרש,customer_name.eq.מלא');
  console.log('Cleaned bogus rows, error:', error);
}
run();

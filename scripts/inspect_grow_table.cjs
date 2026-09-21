const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('grow_incoming_payments').select('*');
  console.log('grow_incoming_payments count:', data ? data.length : 0);
  if (error) console.log('Error:', error);
  if (data && data.length > 0) {
    console.log('First 3 rows:');
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
  }

  // Also check settings table for grow incoming payments stored in settings or localStorage
  const { data: settingsRow } = await supabase.from('settings').select('*');
  console.log('\nSettings rows count:', settingsRow?.length);
  settingsRow?.forEach(s => {
    console.log('Setting ID:', s.id);
    if (s.data?.growPayments) {
      console.log('growPayments in settings:', s.data.growPayments.length);
    }
  });
}

run();

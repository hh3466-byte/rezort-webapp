const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectSettings() {
  const { data, error } = await supabase.from('settings').select('*');
  console.log('Settings data:', data, 'error:', error);
  if (data && data[0]) {
    console.log('Columns of settings table:', Object.keys(data[0]));
  }
}

inspectSettings();

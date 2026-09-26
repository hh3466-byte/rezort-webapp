const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: rows, error } = await supabase.from('settings').select('*');
  console.log('Settings rows count:', rows?.length, error);
  rows?.forEach((r, idx) => {
    console.log(`\nRow #${idx}: id=${r.id}`);
    console.log('last1830SanitySentDate:', r.data?.last1830SanitySentDate);
    console.log('last1830SanitySentTimestamp:', r.data?.last1830SanitySentTimestamp);
    console.log('updated_at:', r.updated_at);
  });
}

run();

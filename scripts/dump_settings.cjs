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
  const { data, error } = await supabase.from('settings').select('*');
  if (error) {
    console.error(error);
    return;
  }
  const row = data[0];
  console.log('Columns in row:', Object.keys(row));
  console.log('Data keys in row.data:', Object.keys(row.data || {}));
  console.log({
    greenApiIdInstance: row.data?.greenApiIdInstance,
    greenApiToken: row.data?.greenApiToken,
    hasTokenInRoot: Boolean(row.green_api_token || row.greenApiToken)
  });
}

run();

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

async function main() {
  const { data: s } = await supabase.from('settings').select('*');
  console.log('SETTINGS RAW KEYS:', Object.keys(s[0]));
  console.log('bank_details column:', s[0].bank_details);
  console.log('data.bankDetails:', s[0].data?.bankDetails);
  console.log('manager_phone:', s[0].manager_phone);
  console.log('data.managerPhone:', s[0].data?.managerPhone);
  console.log('data.bitNumber:', s[0].data?.bitNumber);
  console.log('bit_number column:', s[0].bit_number);
}

main().catch(console.error);

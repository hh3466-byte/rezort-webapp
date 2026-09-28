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
  const { data: s } = await supabase.from('settings').select('*').limit(1);
  const list = s?.[0]?.data?.intakeRequests || [];
  const found = list.filter(r => (r.dogName || '').includes('קצ') || (r.dogName || '').includes('cachete') || (r.ownerName || '').includes('פליטמן'));
  console.log('Found in settings.data.intakeRequests:', JSON.stringify(found, null, 2));
}

run();

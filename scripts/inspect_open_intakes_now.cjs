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
  const { data: sRow } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const intakes = (sRow?.data?.intakeRequests) || [];
  const open = intakes.filter(r => r.status !== 'archived' && r.status !== 'abandoned' && r.status !== 'approved');
  console.log('Open unhandled intakes in DB count:', open.length);
  console.log(JSON.stringify(open.map(r => ({
    id: r.id,
    dog: r.dogName,
    owner: r.ownerName,
    dates: (r.startDate || '') + ' to ' + (r.endDate || ''),
    status: r.status
  })), null, 2));
}

run();

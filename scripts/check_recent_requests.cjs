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
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'resort_config')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  const list = data?.data?.intakeRequests || [];
  console.log('Total intake requests in settings.data:', list.length);
  list.slice(0, 10).forEach(x => {
    console.log({
      id: x.id,
      createdAt: x.createdAt,
      ownerName: x.ownerName,
      dogName: x.dogName,
      phone: x.ownerPhone,
      status: x.status,
      depositRequested: x.depositRequested,
      internalNotes: x.internalNotes
    });
  });
}

run();

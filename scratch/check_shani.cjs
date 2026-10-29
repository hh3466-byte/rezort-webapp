const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let envContent = '';
try { envContent = fs.readFileSync('.env.local', 'utf8'); } catch(e) {
  try { envContent = fs.readFileSync('.env', 'utf8'); } catch(e2) {}
}
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
  const { data: settings } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  const passes = settings?.data?.daycare_passes || [];
  const shaniPasses = passes.filter(p => (p.ownerName && p.ownerName.includes('שני')) || (p.dogName && p.dogName.includes('שני')));
  console.log('Shani passes in resort_config:', JSON.stringify(shaniPasses, null, 2));

  const reqs = settings?.data?.intakeRequests || [];
  console.log('Total intakeRequests in settings:', reqs.length);
  const shani = reqs.filter(r => (r.ownerName && r.ownerName.includes('שני')) || (r.dogName && r.dogName.includes('שני')) || (r.ownerPhone && r.ownerPhone.includes('6474151')));
  console.log('Shani in settings.data.intakeRequests:', JSON.stringify(shani, null, 2));
  console.log('Last 5 intake requests:', JSON.stringify(reqs.slice(0, 5).map(r => ({ id: r.id, name: r.ownerName, dog: r.dogName, date: r.createdAt, notes: r.notes, status: r.status })), null, 2));
}

run();

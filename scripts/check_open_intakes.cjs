const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: sRows } = await supabase.from('settings').select('*');
  const settingsData = sRows?.[0]?.data || {};
  const intakes = settingsData.intakeRequests || [];
  const openIntakes = intakes.filter(i => i.status !== 'archived' && i.status !== 'approved' && i.status !== 'cancelled');
  console.log('Open intake requests:', openIntakes.length);
  openIntakes.forEach(i => {
    console.log({
      id: i.id,
      dog: i.dogName || i.dog_name,
      owner: i.ownerName || i.owner_name,
      phone: i.ownerPhone || i.owner_phone,
      start: i.startDate || i.start_date,
      end: i.endDate || i.end_date,
      status: i.status
    });
  });
}
check();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim();
  });
} catch(e) {}

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function findWhisky() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  if (error || !data) {
    console.error('Error fetching settings:', error);
    return;
  }
  const intakes = data.data.intakeRequests || [];
  console.log('Total intake requests in settings:', intakes.length);
  
  const whiskyIntakes = intakes.filter(i => {
    const s = JSON.stringify(i);
    return s.includes('ויסקי') || s.includes('וויסקי') || s.toLowerCase().includes('whisky') || s.toLowerCase().includes('whiskey');
  });

  console.log('--- WHISKY INTAKE DETAILS ---');
  console.log(JSON.stringify(whiskyIntakes, null, 2));

  console.log('\n--- ALL INTAKES SUMMARY ---');
  intakes.forEach((i, idx) => {
    console.log(`${idx + 1}. Dog: "${i.dogName}", Owner: "${i.ownerName}" (${i.ownerPhone}), Status: ${i.status}, Dates: ${i.startDate} -> ${i.endDate}, Notes: "${i.internalNotes || ''}", ID: ${i.id}`);
  });
}

findWhisky();

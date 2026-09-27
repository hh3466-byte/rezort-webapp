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

async function checkRecentIntakes() {
  const { data } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const intakes = data.data.intakeRequests || [];
  
  console.log('--- Checking Intakes from Sept 20-27 ---');
  intakes.forEach((i, idx) => {
    if (i.createdAt && i.createdAt >= '2026-09-20') {
      console.log(`[${idx+1}] ID: ${i.id} | Dog: "${i.dogName}" | Owner: "${i.ownerName}" (${i.ownerPhone}) | Created: ${i.createdAt} | Status: ${i.status} | Notes: "${i.internalNotes || ''}"`);
    }
  });
}

checkRecentIntakes();

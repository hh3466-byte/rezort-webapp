const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data: sRow } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  const intakes = sRow?.data?.intakeRequests || [];
  console.log('Total intakes:', intakes.length);
  const relevant = intakes.filter(r => (r.ownerPhone && (r.ownerPhone.includes('5000052') || r.ownerPhone.includes('4461741'))));
  console.log('Relevant intakes:', JSON.stringify(relevant, null, 2));

  // Also check if there's any other table for intake_requests or leads
  const { data: tables, error } = await supabase.from('intake_requests').select('*').limit(5);
  if (!error) {
    console.log('intake_requests table exists, count/sample:', tables.length);
  } else {
    console.log('intake_requests table query error/not used:', error.message);
  }
}
run();

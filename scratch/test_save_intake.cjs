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
  const { data, error } = await supabase
    .from('intake_requests')
    .upsert({
      id: 'test-intake-' + Date.now(),
      created_at: new Date().toISOString(),
      status: 'pending',
      owner_name: 'בדיקה',
      owner_phone: '0501234567',
      dog_name: 'רקס',
      serviceType: 'daycare'
    });

  console.log('Error inserting with serviceType:', error);

  // Let's check table columns of intake_requests
  const { data: cols, error: colErr } = await supabase.from('intake_requests').select('*').limit(1);
  console.log('intake_requests sample row / keys:', cols ? Object.keys(cols[0] || {}) : colErr);
}

run();

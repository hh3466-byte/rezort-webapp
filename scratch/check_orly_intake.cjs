const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:/Projects/הריזורט לכלב/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: intakes } = await supabase.from('intake_requests').select('*').ilike('owner_phone', '%3077737%');
  console.log('Intake for Orly:', JSON.stringify(intakes, null, 2));

  // Check any webhook logs or other logs
  const { data: b } = await supabase.from('bookings').select('*').eq('id', 'b-1792311170175');
  console.log('Current booking in DB:', JSON.stringify(b, null, 2));
}

run().catch(console.error);

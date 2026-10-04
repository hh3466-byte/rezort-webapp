const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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
  const tables = ['bookings', 'settings', 'grow_incoming_payments', 'intake_requests', 'intake_forms', 'leads', 'clients', 'messages'];
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select('*');
      if (error) {
        console.log(`Table ${t}: error ${error.message}`);
      } else {
        console.log(`Table ${t}: ${data.length} rows`);
        const found = data.filter(r => JSON.stringify(r).includes('ניבה') || JSON.stringify(r).includes('פורן') || JSON.stringify(r).includes('שטוץ') || JSON.stringify(r).includes('7900781'));
        if (found.length > 0) {
          console.log(`  --> Matched in ${t}:`, JSON.stringify(found, null, 2));
        }
      }
    } catch(e) {
      console.log(`Table ${t}: exception ${e.message}`);
    }
  }
}

run();

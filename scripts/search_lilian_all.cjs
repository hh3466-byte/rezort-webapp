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
  const tables = ['bookings', 'intake_requests', 'dogs', 'clients', 'community_members', 'grow_incoming_payments'];
  for (const t of tables) {
    const { data } = await supabase.from(t).select('*');
    if (!data) continue;
    const matches = data.filter(row => {
      const s = JSON.stringify(row);
      return s.includes('526340385') || s.includes('ליליאן') || s.includes('דלויה') || s.includes('leedaluoya');
    });
    console.log(`Table ${t} matches:`, matches.length);
    if (matches.length > 0) {
      console.log(JSON.stringify(matches, null, 2));
    }
  }
}

run();

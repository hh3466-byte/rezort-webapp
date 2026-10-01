const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[m[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkAllGrowFor4500() {
  console.log('=== CHECKING ALL SUPABASE TABLES FOR 4500 / 6500 / ITAY ===');
  const tables = ['bookings', 'resort_settings', 'settings', 'intake_forms'];
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select('*');
      if (data) {
        const matches = data.filter(row => {
          const s = JSON.stringify(row);
          return s.includes('4500') || s.includes('6500') || s.includes('4900844785') || s.includes('3044647') || s.includes('4452521');
        });
        console.log(`Table ${t}: found ${matches.length} matches`);
        matches.forEach(m => console.log('Match in ' + t + ':', JSON.stringify(m).slice(0, 300)));
      }
    } catch(e) {}
  }
}

checkAllGrowFor4500();

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

// Import the formatTomorrowOverviewReport from script or inline
async function test() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsData } = await supabase.from('settings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  const sRow = settingsData[0] || {};
  const s = { ...sRow, ...(sRow.data || {}) };

  // Run the script function
  const scriptContent = fs.readFileSync('scripts/send_shmulik_summary_and_tomorrow.cjs', 'utf8');
  // eval format function
  const fnMatch = scriptContent.match(/function formatTomorrowOverviewReport[\s\S]*?(?=async function sendMessages)/);
  if (fnMatch) {
    eval(fnMatch[0]);
    // evaluate helper functions
    const helpers = scriptContent.match(/const HEBREW_DAYS[\s\S]*?(?=function formatTomorrowOverviewReport)/);
    eval(helpers[0]);
    
    const report = formatTomorrowOverviewReport('שמוליק', bookings, s, intakes, '2026-09-19');
    console.log('--- GENERATED REPORT FOR 19.09 -> 20.09 ---');
    console.log(report);
  }
}

test();

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
  const { formatReport } = await import('../api/cron-evening-report.js');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = sRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const intakes = settings.intakeRequests || [];
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  const todayStr = '2026-10-06';
  const report = formatReport('שמוליק', bookings || [], settings, intakes, growPayments || [], todayStr, []);
  console.log('=== 19:00 PREVIEW REPORT FOR TOMORROW ===\n');
  console.log(report);
}

run();

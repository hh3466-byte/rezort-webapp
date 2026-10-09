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

async function testEveningReport() {
  const { data: dbRows } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  const eveningReport = await import('../api/cron-evening-report.js');
  const todayStr = '2026-10-08';
  
  console.log('Testing generateTomorrowOverviewMessage from cron-evening-report...');
  const msg = eveningReport.formatReport(
    'שמוליק',
    dbRows || [],
    settings,
    intakes || [],
    growPayments || [],
    todayStr,
    []
  );

  console.log('--- Tomorrow Overview Generated ---');
  console.log(msg);
}

testEveningReport();

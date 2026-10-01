const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTest() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: payments } = await supabase.from('grow_incoming_payments').select('*');

  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const todayStr = '2026-10-01';

  // Extract formatReport from api/cron-evening-report.js
  const fs = require('fs');
  let fileContent = fs.readFileSync('api/cron-evening-report.js', 'utf8');

  fileContent = fileContent
    .replace("import { createClient } from '@supabase/supabase-js';", "const { createClient } = require('@supabase/supabase-js');")
    .replace("export default async function handler", "async function handler")
    + "\nmodule.exports = { formatReport };";

  const tempFile = 'scripts/temp_evening_report.cjs';
  fs.writeFileSync(tempFile, fileContent);
  const { formatReport } = require('./temp_evening_report.cjs');
  fs.unlinkSync(tempFile);

  const report = formatReport('שמוליק', bookings || [], settings, intakes || [], payments || [], todayStr, []);
  console.log('=== 19:00 TOMORROW OVERVIEW REPORT FOR SHMULIK & MANAGER ===\n');
  console.log(report);
}

runTest();

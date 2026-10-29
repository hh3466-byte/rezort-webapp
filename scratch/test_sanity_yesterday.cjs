const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { run1830SanityAudit } = await import('../api/cron-sanity-check.js');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const allIntakes = (intakes && intakes.length > 0) ? intakes : (settings.intakeRequests || []);

  // Let's run with growPayments passed
  try {
    const res = run1830SanityAudit(bookings || [], settings, allIntakes, [], '2026-10-20', growPayments || []);
    console.log('Result:');
    console.log(res.reportText);
  } catch (e) {
    console.error('Error running audit:', e);
  }
}
run();

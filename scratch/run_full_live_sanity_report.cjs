const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function generateReport() {
  const { run1830SanityAudit } = await import('../api/cron-sanity-check.js');

  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsArr } = await supabase.from('settings').select('*');
  const settings = settingsArr?.[0] || {};
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  const sData = settings.data || {};
  const intakes = sData.intakeRequests || sData.intakeForms || [];

  const todayStr = '2026-10-16';

  console.log(`Running live sanity audit for ${todayStr}...`);
  console.log(`Total bookings in DB: ${bookings.length}`);
  console.log(`Total grow payments in DB: ${growPayments.length}`);

  const res = run1830SanityAudit(bookings, settings, intakes, [], todayStr, growPayments || []);

  console.log('\n======================================================');
  console.log(res.reportText);
  console.log('======================================================\n');
  console.log('Summary:', { totalGreen: res.totalGreen, totalRed: res.totalRed });
}

generateReport().catch(console.error);

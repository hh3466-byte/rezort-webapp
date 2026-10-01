const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testEveningReport() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: payments } = await supabase.from('grow_incoming_payments').select('*');

  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const todayStr = '2026-10-01';

  // Test the format function directly
  const fs = require('fs');
  const code = fs.readFileSync('api/cron-evening-report.js', 'utf8');

  // Let's run handler or test format
  console.log('Testing 19:00 evening report generation...');
  // Import via dynamic import
  const module = await import('../api/cron-evening-report.js');
  // Or test through API
  console.log('Bookings loaded:', bookings.length);
  console.log('Grow payments loaded:', payments.length);
}

testEveningReport();

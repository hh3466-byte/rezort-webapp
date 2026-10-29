const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function previewTomorrowReport() {
  const { formatReport } = await import('../api/cron-evening-report.js');
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const settings = { ...sRows[0], ...(sRows[0].data || {}) };
  const { data: bookingsRaw } = await supabase.from('bookings').select('*');
  const bookings = (bookingsRaw || []).map(b => ({
    ...b,
    ...(b.data || {}),
    kennelNumber: b.data?.kennelNumber || b.kennel_number || b.kennelNumber
  }));
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: payments } = await supabase.from('grow_incoming_payments').select('*');

  const todayStr = '2026-10-22';
  const msg = formatReport('שמוליק', bookings, settings, intakes || [], payments || [], todayStr, [], 'shmulik');
  console.log('--- PREVIEW 19:00 REPORT FOR SHMULIK ---');
  console.log(msg);
}

previewTomorrowReport().catch(console.error);

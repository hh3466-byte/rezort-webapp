const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function inspectAll() {
  // Check settings table rows
  const { data: settingsRows } = await supabase.from('settings').select('*');
  console.log('--- SETTINGS ROWS ---');
  settingsRows?.forEach(r => {
    console.log('Row ID:', r.id, 'Keys in data:', r.data ? Object.keys(r.data) : 'none');
    if (r.data?.archivedIntakeRequests) {
      console.log('archivedIntakeRequests count:', r.data.archivedIntakeRequests.length);
    }
  });

  // Check if there is an intake_requests table
  const { data: intakes, error: errIntakes } = await supabase.from('intake_requests').select('*');
  console.log('intake_requests table error:', errIntakes?.message || 'none', 'count:', intakes?.length);
  if (intakes?.length) {
    intakes.forEach(i => console.log('intake_requests row:', i.id, i.owner_name, i.dog_name, i.status));
  }

  // Check leads or messages table
  const { data: leads, error: errLeads } = await supabase.from('leads').select('*');
  console.log('leads table count:', leads?.length, 'error:', errLeads?.message || 'none');

  // Check stays table
  const { data: stays, error: errStays } = await supabase.from('stays').select('*').limit(20);
  console.log('stays table count:', stays?.length, 'error:', errStays?.message || 'none');
}
inspectAll();

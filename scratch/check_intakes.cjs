const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) { console.error('Error:', error); return; }
  for (const row of data) {
    if (row.data && row.data.intakeRequests) {
      console.log('Row ID:', row.id, 'Total intake requests:', row.data.intakeRequests.length);
      row.data.intakeRequests.forEach((r, i) => {
        console.log(`[${i+1}] ID: ${r.id} | Name: ${r.ownerName} | Dog: ${r.dogName} | Phone: ${r.ownerPhone} | Status: ${r.status} | Dates: ${r.startDate} -> ${r.endDate} | StaffNotes: ${(r.staffNotes || '').slice(0, 30)}`);
      });
    }
  }
}
check();

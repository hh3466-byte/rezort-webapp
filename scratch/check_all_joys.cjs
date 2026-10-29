const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkAllJoys() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const joys = bookings.filter(b => {
    const s = JSON.stringify(b);
    return s.includes('ג\'וי') || s.includes('ירוס') || s.includes('0556646093') || (b.notes && b.notes.includes('ירוס'));
  });
  console.log(`Found ${joys.length} Joy bookings:`);
  joys.forEach(b => {
    console.log(`ID: ${b.id} | Name: ${b.dog_name || b.dogName} | Owner: ${b.owner_name || b.ownerName} | Dates: ${b.start_date || b.startDate} -> ${b.end_date || b.endDate} | Status: ${b.stay_status || b.stayStatus} | Updated: ${b.updated_at}`);
  });
}

checkAllJoys();

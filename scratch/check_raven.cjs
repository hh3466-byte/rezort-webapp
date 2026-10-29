const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkRaven() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const ravens = bookings.filter(b => {
    const s = JSON.stringify(b);
    return s.includes('רייבן') || s.includes('יערה') || s.includes('050-3633833') || s.includes('0503633833');
  });
  console.log(`Found ${ravens.length} Raven bookings:`);
  ravens.forEach(b => {
    console.log(JSON.stringify(b, null, 2));
  });
}

checkRaven();

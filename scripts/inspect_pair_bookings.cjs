const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

async function inspectPairs() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const data = await res.json();
  
  const pairBookings = data.filter(b => {
    const name = (b.dog_name || '').trim();
    return name.includes(' ו') || name.includes(' ו-') || name.includes(' + ') || name.includes('&') || name.includes(' and ');
  });

  console.log(`Found ${pairBookings.length} paired bookings in DB:\n`);
  pairBookings.forEach(b => {
    console.log(JSON.stringify(b, null, 2));
    console.log('--------------------------------------------------');
  });
}

inspectPairs();

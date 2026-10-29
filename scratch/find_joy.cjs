const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function findJoy() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const joyBookings = bookings.filter(b => {
    const s = JSON.stringify(b);
    return s.includes('ירוס') || s.includes('ביקהיה') || s.includes('0556646093') || s.includes('b-joy') || s.includes('ג\'וי');
  });

  console.log('Joy bookings count:', joyBookings.length);
  joyBookings.forEach(b => {
    console.log(JSON.stringify(b, null, 2));
  });
}

findJoy();

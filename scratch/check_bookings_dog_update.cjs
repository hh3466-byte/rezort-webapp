const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkBookings() {
  const { data: bookings } = await supabase.from('bookings').select('id, dog_name, owner_name, data');
  console.log('--- BOOKINGS WITH lastDailyDogUpdateSent ---');
  bookings.forEach(b => {
    if (b.data?.lastDailyDogUpdateSent) {
      console.log(`${b.dog_name} (${b.owner_name}): lastDailyDogUpdateSent = ${b.data.lastDailyDogUpdateSent}`);
    }
  });
}

checkBookings();

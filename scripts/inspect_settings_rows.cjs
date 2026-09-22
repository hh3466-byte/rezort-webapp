const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: sRows, error: sErr } = await supabase.from('settings').select('*');
  console.log('Settings rows:', sRows, sErr);

  const { data: bRows, error: bErr } = await supabase.from('bookings').select('id, dog_name, service_type, trainer_stages').ilike('dog_name', '%לונה%');
  console.log('Luna bookings:', bRows, bErr);
}

run().catch(console.error);

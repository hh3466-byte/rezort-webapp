const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: bRows, error: bErr } = await supabase.from('bookings').select('*').ilike('dog_name', '%לונה%');
  console.log('Luna bookings in Supabase:');
  for (const b of bRows || []) {
    console.log(`ID: ${b.id}, Dog: ${b.dog_name}, Service: ${b.service_type}, Start: ${b.start_date}, End: ${b.end_date}, Notes: ${b.notes}`);
    console.log('Data field:', b.data);
  }
}

run().catch(console.error);

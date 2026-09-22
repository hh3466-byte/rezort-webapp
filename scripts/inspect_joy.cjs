const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: joys } = await supabase.from('bookings').select('*').ilike('dog_name', '%ג\'וי%');
  for (const j of joys) {
    console.log(`Joy: ID=${j.id}, Start=${j.start_date}, End=${j.end_date}, Service=${j.service_type}, Notes=${j.notes}`);
    console.log('Data:', j.data);
  }
}

run().catch(console.error);

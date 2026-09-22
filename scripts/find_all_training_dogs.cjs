const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('--- Fetching all bookings for Joy, Theo, Luna (Ronen), Luna (Shlomi) ---');
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*');

  if (error) throw error;

  console.log(`Total bookings in DB: ${bookings.length}`);

  const targetDogs = ['ג\'וי', 'תיאו', 'תיאן', 'לונה', 'לונה המתגעגעת'];
  const matched = bookings.filter(b => {
    const name = b.dog_name || '';
    const owner = b.owner_name || '';
    return targetDogs.some(t => name.includes(t) || owner.includes(t));
  });

  console.log('\nMatched bookings:');
  for (const b of matched) {
    console.log(`- ID: ${b.id} | Dog: "${b.dog_name}" | Owner: "${b.owner_name}" | Service: ${b.service_type} | Start: ${b.start_date}`);
  }
}

run().catch(console.error);

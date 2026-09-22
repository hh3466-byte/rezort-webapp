const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) throw error;

  console.log(`=== ALL BOOKINGS (${bookings.length}) ===`);
  const trainingDogs = ['ג\'וי', 'לונה', 'תיאו', 'בוס'];

  bookings.forEach(b => {
    const isTarget = trainingDogs.some(t => (b.dog_name || '').includes(t) || (b.owner_name || '').includes(t));
    if (isTarget || b.service_type === 'training') {
      console.log(`\nID: ${b.id}`);
      console.log(`  Dog: ${b.dog_name} | Owner: ${b.owner_name} | Phone: ${b.owner_phone}`);
      console.log(`  Service: ${b.service_type} | Dates: ${b.start_date} -> ${b.end_date}`);
      console.log(`  Trainer Stages:`, b.data?.trainerStages || b.trainer_stages);
      console.log(`  isTrainingCompleted:`, b.data?.isTrainingCompleted);
    }
  });
}

run().catch(console.error);

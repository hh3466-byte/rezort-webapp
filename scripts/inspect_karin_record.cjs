const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectKarinRecord() {
  const { data: bList } = await supabase.from('bookings').select('*');
  const karinB = bList.filter(b => (b.owner_name && b.owner_name.includes('קארין')) || (b.dog_name && b.dog_name.includes('שון')));
  console.log('Bookings:', JSON.stringify(karinB, null, 2));

  const { data: iList } = await supabase.from('intake_requests').select('*');
  const karinI = iList.filter(i => JSON.stringify(i).includes('קארין') || JSON.stringify(i).includes('0546610321'));
  console.log('Intakes:', JSON.stringify(karinI, null, 2));
}

inspectKarinRecord().catch(console.error);

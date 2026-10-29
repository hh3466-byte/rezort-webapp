const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function listAllIntakes() {
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sData = sRows?.[0]?.data || {};
  const list = sData.intakeRequests || [];
  console.log(`Total intakes: ${list.length}`);
  list.forEach(i => {
    console.log(`- ID: ${i.id} | Dog: ${i.dogName || i.dog_name} | Owner: ${i.ownerName || i.owner_name} | Phone: ${i.ownerPhone || i.owner_phone} | Dates: ${i.startDate || i.start_date} -> ${i.endDate || i.end_date} | Status: ${i.status} | Created: ${i.createdAt}`);
  });
}

listAllIntakes().catch(console.error);

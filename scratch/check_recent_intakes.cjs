const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkRecentIntakes() {
  const { data: intakes } = await supabase
    .from('intake_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(`Recent 10 in intake_requests table:`);
  intakes?.forEach(i => {
    console.log(`- ID: ${i.id} | Dog: ${i.dog_name} | Owner: ${i.owner_name} | Phone: ${i.owner_phone} | Dates: ${i.start_date} -> ${i.end_date} | Status: ${i.status} | Created: ${i.created_at}`);
  });
}

checkRecentIntakes().catch(console.error);

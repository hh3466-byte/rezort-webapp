const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkGrowMail() {
  const { data: growAll } = await supabase.from('grow_incoming_payments').select('*');
  const found = growAll.filter(g => JSON.stringify(g).includes('0523679637') || JSON.stringify(g).includes('חלה') || JSON.stringify(g).includes('1924'));
  console.log('Found in grow payments:', found);
}

checkGrowMail();

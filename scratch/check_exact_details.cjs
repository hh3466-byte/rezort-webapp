const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkDetails() {
  const { data: bYuval } = await supabase.from('bookings').select('*').eq('id', 'b-1790241483197').single();
  console.log('Yuval booking:', JSON.stringify(bYuval, null, 2));

  const { data: bTamar } = await supabase.from('bookings').select('*').eq('id', 'b-1792415077707').single();
  console.log('Tamar booking:', JSON.stringify(bTamar, null, 2));

  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Recent Grow payments:', JSON.stringify(growPayments, null, 2));
}

checkDetails();

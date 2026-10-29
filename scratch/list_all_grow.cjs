const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function listAllGrow() {
  const { data, error } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false });
  console.log('Error:', error);
  console.log('Count:', data?.length);
  data?.forEach(r => console.log(r.id, r.amount, r.customer_name, r.customer_phone, r.created_at));
}

listAllGrow();

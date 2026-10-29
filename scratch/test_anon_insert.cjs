const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function testInsert() {
  const { data, error } = await supabase.from('grow_incoming_payments').upsert({
    id: 'test_insert_anon',
    reference_id: 'test_ref',
    amount: 10,
    customer_name: 'test',
    customer_phone: '0523679637'
  });
  console.log('Insert test result:', error);
  if (!error) {
    await supabase.from('grow_incoming_payments').delete().eq('id', 'test_insert_anon');
  }
}
testInsert();

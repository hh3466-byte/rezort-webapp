const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkoutRaven() {
  const { data: b } = await supabase.from('bookings').select('*').eq('id', 'b-1790517583342').single();
  if (!b) {
    console.error('Raven not found');
    return;
  }
  const bData = b.data || {};
  bData.stayStatus = 'checked_out';
  bData.updatedAt = new Date().toISOString();

  const { error } = await supabase.from('bookings').update({
    stay_status: 'checked_out',
    data: bData,
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1790517583342');

  if (error) console.error('Error:', error);
  else console.log('✓ Successfully checked out Raven in database!');
}

checkoutRaven();

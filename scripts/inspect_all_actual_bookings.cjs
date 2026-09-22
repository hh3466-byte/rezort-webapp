const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAll() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log('Total bookings in DB:', (bookings || []).length);
  (bookings || []).forEach(b => {
    console.log(`- ${b.dog_name} (${b.owner_name}) | ${b.start_date}..${b.end_date} | Total: ₪${b.total_price}, Deposit: ₪${b.deposit_amount} | Stay: ${b.stay_status}, Pay: ${b.payment_status} | Phone: ${b.owner_phone}`);
  });

  const { data: sRows } = await supabase.from('settings').select('*');
  const d = sRows?.[0]?.data || {};
  const intakes = d.intakeRequests || [];
  console.log('\nTotal Intake Requests in Settings:', intakes.length);
  intakes.forEach(i => {
    console.log(`- Intake: ${i.dogName} (${i.ownerName}) | Phone: ${i.ownerPhone} | Status: ${i.status}`);
  });
}

checkAll();

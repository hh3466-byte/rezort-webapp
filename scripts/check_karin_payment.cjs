const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkKarin() {
  console.log('--- Checking Bookings for Karin Lahav ---');
  const { data: bookings } = await supabase.from('bookings').select('*');
  
  if (bookings) {
    const karinBookings = bookings.filter(b => 
      (b.ownerName && (b.ownerName.includes('קארין') || b.ownerName.includes('להב'))) ||
      (b.owner_name && (b.owner_name.includes('קארין') || b.owner_name.includes('להב'))) ||
      (b.dogName && (b.dogName.includes('קארין') || b.dogName.includes('להב'))) ||
      (b.dog_name && (b.dog_name.includes('קארין') || b.dog_name.includes('להב')))
    );
    console.log('Bookings found:', JSON.stringify(karinBookings, null, 2));
  }

  console.log('--- Checking Grow Incoming Payments ---');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
  
  if (growPayments) {
    const karinGrow = growPayments.filter(p => 
      JSON.stringify(p).includes('קארין') || JSON.stringify(p).includes('להב') || JSON.stringify(p).includes('440')
    );
    console.log('Grow payments found:', JSON.stringify(karinGrow, null, 2));
  }

  console.log('--- Checking Settings Ledger / Intakes ---');
  const { data: settingsRows } = await supabase.from('settings').select('*');
  if (settingsRows) {
    const sData = settingsRows[0]?.data || {};
    const ledger = sData.growLedger || sData.verifiedGrowLedger || [];
    const karinLedger = ledger.filter(t => 
      JSON.stringify(t).includes('קארין') || JSON.stringify(t).includes('להב') || JSON.stringify(t).includes('440')
    );
    console.log('Ledger found:', JSON.stringify(karinLedger, null, 2));
  }

  console.log('--- Checking Intake Requests ---');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  if (intakes) {
    const karinIntakes = intakes.filter(i => 
      JSON.stringify(i).includes('קארין') || JSON.stringify(i).includes('להב')
    );
    console.log('Intakes found:', JSON.stringify(karinIntakes, null, 2));
  }
}

checkKarin().catch(console.error);

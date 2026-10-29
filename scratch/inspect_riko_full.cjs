const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function inspectRikoBooking() {
  const { data: b1 } = await supabase.from('bookings').select('*').eq('id', 'b-1792341775847');
  console.log('--- BOOKING b-1792341775847 ---');
  console.log(JSON.stringify(b1[0], null, 2));

  // Also check all passes in settings.data
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sData = sRows?.[0]?.data || {};
  console.log('\n--- CUSTOMER PASSES IN SETTINGS ---');
  const passes = sData.daycarePasses || sData.customerPasses || [];
  passes.forEach(p => {
    if (String(p.ownerPhone || '').includes('6474151') || String(p.passCode).includes('8935') || String(p.ownerName).includes('שני')) {
      console.log(JSON.stringify(p, null, 2));
    }
  });
}

inspectRikoBooking().catch(console.error);

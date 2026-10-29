const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectData() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  console.log('=== ACTIVE BOOKINGS ===');
  bookings.filter(b => b.stay_status !== 'cancelled' && b.stay_status !== 'archived').forEach(b => {
    const s = b.start_date || b.startDate;
    const e = b.end_date || b.endDate;
    const dog = b.dog_name || b.dogName;
    const owner = b.owner_name || b.ownerName;
    const st = b.stay_status || b.stayStatus;
    const sType = b.service_type || b.serviceType;
    const rm = b.room_id || b.roomId || 'NONE';
    const pSt = b.payment_status || b.paymentStatus;
    const price = b.total_price || b.totalPrice;
    const dep = b.deposit_amount || b.depositAmount;
    console.log(`[${st}] ${dog} (${owner}) | ${s} -> ${e} | type: ${sType} | room: ${rm} | pay: ${pSt} | price: ${price} | dep: ${dep}`);
  });

  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sData = sRows?.[0]?.data || {};
  const allIntakes = (intakes && intakes.length > 0) ? intakes : (sData.intakeRequests || []);

  console.log('\n=== INTAKES ===');
  allIntakes.filter(i => i.status !== 'archived').forEach(i => {
    const dog = i.dog_name || i.dogName;
    const owner = i.owner_name || i.ownerName;
    const phone = i.owner_phone || i.ownerPhone;
    const s = i.start_date || i.startDate;
    const e = i.end_date || i.endDate;
    console.log(`[${i.status}] ${dog} (${owner}, ${phone}) | ${s} -> ${e}`);
  });
}
inspectData();

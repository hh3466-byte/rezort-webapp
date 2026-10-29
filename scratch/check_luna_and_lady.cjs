const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function run() {
  console.log('=== SEARCHING LUNA IN BOOKINGS ===');
  const { data: lunaBookings } = await supabase.from('bookings').select('*');
  const lunas = lunaBookings?.filter(b => {
    const str = JSON.stringify(b);
    return str.includes('לונה') || str.toLowerCase().includes('luna');
  });
  console.log('Luna bookings count:', lunas?.length);
  lunas?.forEach(b => {
    console.log(JSON.stringify({
      id: b.id,
      owner_name: b.owner_name || b.ownerName,
      owner_phone: b.owner_phone || b.ownerPhone,
      dog_name: b.dog_name || b.dogName,
      dates: `${b.start_date || b.startDate} -> ${b.end_date || b.endDate}`,
      total_price: b.total_price || b.totalPrice,
      deposit_amount: b.deposit_amount || b.depositAmount,
      payment_status: b.payment_status || b.paymentStatus,
      payment_method: b.payment_method || b.paymentMethod,
      stay_status: b.stay_status || b.stayStatus,
      notes: b.notes,
      data: b.data
    }, null, 2));
  });

  console.log('=== SEARCHING LADY / TAMAR / 360 ===');
  const ladyMatches = lunaBookings?.filter(b => {
    const str = JSON.stringify(b);
    return str.includes('ליידי') || str.includes('תמר') || str.includes('0523679637') || str.includes('חלה') || str.includes('קובי');
  });
  console.log('Lady / Tamar matches in bookings:', ladyMatches?.length);
  ladyMatches?.forEach(b => {
    console.log(JSON.stringify({
      id: b.id,
      owner_name: b.owner_name || b.ownerName,
      owner_phone: b.owner_phone || b.ownerPhone,
      dog_name: b.dog_name || b.dogName,
      dates: `${b.start_date || b.startDate} -> ${b.end_date || b.endDate}`,
      total_price: b.total_price || b.totalPrice,
      deposit_amount: b.deposit_amount || b.depositAmount,
      payment_status: b.payment_status || b.paymentStatus,
      notes: b.notes,
      data: b.data
    }, null, 2));
  });

  console.log('=== SEARCHING GROW PAYMENTS ===');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
  const matchingGrow = growPayments?.filter(p => {
    const str = JSON.stringify(p);
    return str.includes('לונה') || str.includes('ליידי') || str.includes('תמר') || str.includes('0523679637') || str.includes('360') || str.includes('4500') || str.includes('חלה');
  });
  console.log('Matching Grow payments:', matchingGrow?.length);
  matchingGrow?.forEach(p => console.log(JSON.stringify(p, null, 2)));

  console.log('=== SEARCHING INTAKES ===');
  const { data: intakes } = await supabase.from('intake_forms').select('*');
  const matchingIntakes = intakes?.filter(i => {
    const str = JSON.stringify(i);
    return str.includes('לונה') || str.includes('ליידי') || str.includes('תמר') || str.includes('0523679637') || str.includes('חלה');
  });
  console.log('Matching intakes:', matchingIntakes?.length);
  matchingIntakes?.forEach(i => console.log(JSON.stringify({
    id: i.id,
    owner_name: i.owner_name || i.ownerName,
    owner_phone: i.owner_phone || i.ownerPhone,
    dog_name: i.dog_name || i.dogName,
    status: i.status,
    dates: `${i.start_date || i.startDate} -> ${i.end_date || i.endDate}`,
    total_price: i.total_price || i.totalPrice
  }, null, 2)));
}

run();

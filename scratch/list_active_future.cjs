const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const today = '2026-10-16';
  const activeAndFuture = bookings.filter(b => {
    const end = b.end_date || b.endDate || '';
    const status = b.stay_status || b.stayStatus || '';
    return end >= today && status !== 'cancelled' && status !== 'checked_out' && status !== 'archived';
  }).sort((a,b) => (a.start_date || a.startDate).localeCompare(b.start_date || b.startDate));

  console.log(`Total Active & Future: ${activeAndFuture.length}`);
  activeAndFuture.forEach((b, idx) => {
    const dog = b.dog_name || b.dogName;
    const owner = b.owner_name || b.ownerName;
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const total = b.total_price || b.totalPrice;
    const deposit = b.deposit_amount || b.depositAmount;
    const pStatus = b.payment_status || b.paymentStatus;
    const sStatus = b.stay_status || b.stayStatus;
    const method = b.payment_method || b.paymentMethod;
    const phone = b.owner_phone || b.ownerPhone;
    const notes = b.notes || b.data?.notes || '';
    console.log(`${idx + 1}. [${start}..${end}] ${dog} (${owner}) - סה"כ: ₪${total}, מקדמה: ₪${deposit}, סטטוס: ${pStatus} (${sStatus}), אמצעי: ${method}, טלפון: ${phone}`);
    if (notes) console.log(`   הערות: ${notes.slice(0, 100)}...`);
  });
}
run();

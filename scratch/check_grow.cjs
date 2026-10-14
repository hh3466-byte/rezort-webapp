const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkGrowAndBookings() {
  console.log('--- GROW INCOMING PAYMENTS ---');
  const { data: grow, error: growErr } = await supabase.from('grow_incoming_payments').select('*');
  if (growErr) {
    console.error('Grow error:', growErr);
  } else {
    console.log(`Total grow payments count: ${grow?.length}`);
    let sumTotal = 0;
    let sumCurrentMonth = 0;
    grow?.forEach(p => {
      console.log(`Payment: ID=${p.id} | Amount=${p.amount} | Date=${p.payment_date || p.created_at} | Customer=${p.customer_name} | Dog=${p.dog_name} | Method=${p.payment_method} | Status=${p.status}`);
      sumTotal += Number(p.amount || 0);
      const d = p.payment_date || p.created_at || '';
      if (d.includes('2026-10')) {
        sumCurrentMonth += Number(p.amount || 0);
      }
    });
    console.log(`Total sum: ₪${sumTotal}`);
    console.log(`October 2026 sum (due on 10 Nov): ₪${sumCurrentMonth}`);
  }

  console.log('\n--- BOOKINGS ---');
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  if (bErr) {
    console.error('Bookings error:', bErr);
  } else {
    console.log(`Total bookings count: ${bookings?.length}`);
    bookings?.forEach(b => {
      console.log(`Booking: ${b.id} | ${b.ownerName || b.owner_name} | Dog: ${b.dogName || b.dog_name} | Dates: ${b.startDate || b.start_date}..${b.endDate || b.end_date} | Total: ${b.totalPrice || b.total_price} | Deposit: ${b.depositAmount || b.deposit_amount} | Status: ${b.stayStatus || b.stay_status}`);
    });
  }
}
checkGrowAndBookings();

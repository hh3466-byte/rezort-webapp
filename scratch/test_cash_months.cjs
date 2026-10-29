const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function testRevenue() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: grow } = await supabase.from('grow_incoming_payments').select('*');

  // Let's inspect bookings for Sep and Oct cash
  console.log('Bookings with cash in Sep:');
  bookings.forEach(b => {
    const d = b.data || {};
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).toLowerCase();
    const payMethod = String(b.payment_method || b.paymentMethod || d.paymentMethod || '').toLowerCase();
    const isCash = payMethod === 'cash' || notes.includes('מזומן') || notes.includes('שטרות') || notes.includes('קופה');
    if (isCash) {
      console.log(`- ${b.owner_name || b.ownerName} (${b.dog_name || b.dogName}): dates=${b.start_date || b.startDate}..${b.end_date || b.endDate}, created=${b.created_at || d.createdAt}, total=${b.total_price || b.totalPrice}, notes=${notes.slice(0, 80)}`);
    }
  });
}

testRevenue();

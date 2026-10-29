const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkBookings() {
  const { data: bRows, error: bErr } = await supabase.from('bookings').select('*');
  const allBookings = (bRows || []).map(r => ({ id: r.id, ...(r.data || r) }));
  const saarBookings = allBookings.filter(b => 
    (b.ownerPhone && b.ownerPhone.includes('5716886')) ||
    (b.dogName && (b.dogName.includes('ירדנה') || b.dogName.includes('קצח'))) ||
    (b.ownerName && b.ownerName.includes('סער'))
  );

  console.log('Found saar bookings:', saarBookings.length);
  saarBookings.sort((a,b) => (a.startDate || '').localeCompare(b.startDate || ''));
  saarBookings.forEach(b => {
    console.log(`ID: ${b.id}, Dog: ${b.dogName}, Dates: ${b.startDate} to ${b.endDate}, passCode: ${b.daycarePassCode || b.data?.daycarePassCode || 'none'}, notes: ${b.notes}`);
  });
}

checkBookings().catch(console.error);

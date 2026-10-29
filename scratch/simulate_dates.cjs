const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

function addDays(d, n) {
  const dt = new Date(d + 'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().split('T')[0];
}

async function run() {
  const { data: bList } = await supabase.from('bookings').select('*');
  const { data: s } = await supabase.from('settings').select('*').limit(1);
  const settings = s[0].data;

  const dt = new Date('2026-10-21T12:00:00Z');
  const end = new Date('2026-11-03T12:00:00Z');

  while (dt <= end) {
    const dateStr = dt.toISOString().split('T')[0];
    const dayBookings = bList.filter(b => b.start_date <= dateStr && b.end_date >= dateStr && b.dog_name && b.dog_name.includes('ריקו'));
    if (dayBookings.length > 0) {
      dayBookings.forEach(b => {
        const pass = (settings.daycare_passes || []).find(p => p.passCode === '8935');
        const passBookings = bList.filter(pb => pb.dog_name && pb.dog_name.includes('ריקו'));
        const stayDateSet = new Set();
        passBookings.forEach(pb => {
          let curr = pb.start_date;
          while (curr < pb.end_date) {
            stayDateSet.add(curr);
            curr = addDays(curr, 1);
          }
        });
        const allStayDates = Array.from(stayDateSet).sort();
        const earliest = allStayDates[0];
        let prior = 0;
        (pass.usageHistory || []).forEach(e => {
          if (!passBookings.some(pb => pb.id === e.bookingId) && (!e.date || e.date < earliest)) {
            prior += (e.daysDeducted || 0);
          }
        });
        const bookedUpTo = allStayDates.filter(x => x <= dateStr).length;
        const consumed = prior + bookedUpTo;
        const remaining = 21 - consumed;
        console.log(`Date: ${dateStr} | Booking: ${b.id} (${b.start_date} to ${b.end_date}) | BookedUpTo: ${bookedUpTo} | Prior: ${prior} | Consumed: ${consumed} | Remaining: ${remaining}`);
      });
    }
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
}
run();

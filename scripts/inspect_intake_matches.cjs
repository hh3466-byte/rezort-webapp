const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const sb = createClient(url, key);

async function run() {
  const { data: bookings } = await sb.from('bookings').select('*');
  const { data: sRows } = await sb.from('settings').select('*');
  const sRow = sRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const intakes = settings.intakeRequests || [];

  console.log('Bookings total:', (bookings || []).length);
  
  const pendingIntakes = intakes.filter(i => i.status === 'pending');
  console.log('Pending intakes total:', pendingIntakes.length);
  pendingIntakes.forEach(i => {
    const cleanPhone = (i.ownerPhone || '').replace(/\D/g, '').slice(-7);
    const dog = (i.dogName || '').trim().toLowerCase();
    const matchedB = (bookings || []).find(b => {
      const bPhone = (b.owner_phone || b.ownerPhone || '').replace(/\D/g, '').slice(-7);
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      return (cleanPhone && bPhone && cleanPhone === bPhone) || (dog && bDog && dog === bDog);
    });
    console.log(`- ${i.dogName} (${i.ownerName} - ${i.ownerPhone}) [${i.startDate} - ${i.endDate}] -> Matched: ${matchedB ? `${matchedB.dog_name} (${matchedB.start_date} עד ${matchedB.end_date})` : 'NO BOOKING'}`);
  });
}
run();

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

async function checkToday() {
  const today = '2026-10-01';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const data = await res.json();
  
  console.log('--- ALL BOOKINGS FOR TODAY (2026-10-01) ---');
  const activeToday = data.filter(b => b.stay_status !== 'cancelled' && b.start_date <= today && b.end_date >= today);
  console.log('Count:', activeToday.length);
  activeToday.forEach(b => {
    console.log(`• ID: ${b.id} | Dog: "${b.dog_name}" | Owner: "${b.owner_name}" | Service: ${b.service_type} | Dates: ${b.start_date} -> ${b.end_date} | Status: ${b.stay_status}`);
  });

  console.log('\n--- ALL BOOKINGS IN DATABASE ---');
  console.log('Total bookings in DB:', data.length);
  // Check if any of Shmulik's 15 dogs exist with different dates or statuses
  const shmulikDogs = [
    'גסי', 'ג\'סי', 'קירה', 'תיאו', 'גוי', 'ג\'וי', 'סינדי', 'דאפי',
    'לולה', 'ברנדי', 'לונה מלמד', 'רייבן', 'סקובי', 'גינגס', 'ג\'ינגס',
    'מייק', 'לונה שלומי', 'טר', 'תור'
  ];

  console.log('\n--- SEARCHING SHMULIK\'S 15 DOGS IN DB ---');
  shmulikDogs.forEach(name => {
    const matches = data.filter(b => (b.dog_name || '').includes(name) || (b.owner_name || '').includes(name));
    if (matches.length > 0) {
      matches.forEach(m => {
        console.log(`Match for "${name}": Dog: "${m.dog_name}", Owner: "${m.owner_name}", Dates: ${m.start_date} to ${m.end_date}, Status: ${m.stay_status}, Service: ${m.service_type}`);
      });
    } else {
      console.log(`❌ NO MATCH FOUND FOR "${name}" in DB`);
    }
  });
}

checkToday();

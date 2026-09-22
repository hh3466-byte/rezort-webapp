const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  
  const joys = bookings.filter(b => (b.dog_name || '').includes('ג\'וי') || (b.data?.dogName || '').includes('ג\'וי'));
  console.log('Joys:', joys.map(j => ({ id: j.id, service: j.service_type, name: j.dog_name, owner: j.owner_name, start: j.start_date, end: j.end_date })));

  const theos = bookings.filter(b => (b.dog_name || '').includes('תיאו') || (b.data?.dogName || '').includes('תיאו'));
  console.log('Theos:', theos.map(t => ({ id: t.id, service: t.service_type, name: t.dog_name, owner: t.owner_name, start: t.start_date, end: t.end_date })));

  const lunas = bookings.filter(b => (b.dog_name || '').includes('לונה') || (b.data?.dogName || '').includes('לונה'));
  console.log('Lunas:', lunas.map(l => ({ id: l.id, service: l.service_type, name: l.dog_name, owner: l.owner_name, start: l.start_date, end: l.end_date })));
}

run().catch(console.error);

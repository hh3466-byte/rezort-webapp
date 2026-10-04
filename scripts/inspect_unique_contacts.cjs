const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectContacts() {
  const { data: bookings } = await supabase.from('bookings').select('owner_name, owner_phone, dog_name, stay_status');
  console.log('Total bookings:', bookings?.length);

  const contactMap = new Map();
  for (const b of (bookings || [])) {
    const rawP = (b.owner_phone || '').replace(/\D/g, '');
    if (!rawP || rawP.length < 8) continue;
    const cleanPhone = rawP.startsWith('972') ? rawP : '972' + (rawP.startsWith('0') ? rawP.slice(1) : rawP);
    
    if (!contactMap.has(cleanPhone)) {
      contactMap.set(cleanPhone, {
        phone: cleanPhone,
        ownerName: (b.owner_name || '').trim(),
        dogName: (b.dog_name || '').trim(),
        hasActiveBooking: b.stay_status !== 'cancelled'
      });
    }
  }

  console.log('Unique contacts found:', contactMap.size);
  let count = 0;
  for (const [phone, info] of contactMap.entries()) {
    if (count++ < 10) {
      console.log(`Phone: ${phone} -> Name: "${info.ownerName} (${info.dogName})"`);
    }
  }
}

inspectContacts();

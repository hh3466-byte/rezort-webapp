const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectBoris() {
  console.log('=== 1. BOOKINGS FOR BORIS BRENNER ===');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const borisBookings = bookings.filter(b => 
    (b.owner_name && b.owner_name.includes('בוריס')) ||
    (b.owner_phone && b.owner_phone.includes('545970156')) ||
    (b.dog_name && b.dog_name.includes('מייק'))
  );
  console.log(JSON.stringify(borisBookings, null, 2));

  console.log('\n=== 2. GROW PAYMENTS FOR BORIS / 0545970156 ===');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
  const borisGrow = (growPayments || []).filter(p => 
    (p.customer_name && p.customer_name.includes('בוריס')) ||
    (p.customer_phone && p.customer_phone.includes('5970156')) ||
    (p.description && p.description.includes('מייק')) ||
    (p.description && p.description.includes('בוריס')) ||
    (p.auth_number && p.auth_number.includes('175551443'))
  );
  console.log(JSON.stringify(borisGrow, null, 2));

  console.log('\n=== 3. ALL GROW PAYMENTS SEARCH BY PHONE OR NAME ===');
  const allRelatedGrow = (growPayments || []).filter(p => 
    JSON.stringify(p).includes('5970156') || 
    JSON.stringify(p).includes('ברנר') ||
    JSON.stringify(p).includes('175551443')
  );
  console.log(JSON.stringify(allRelatedGrow, null, 2));
}

inspectBoris();

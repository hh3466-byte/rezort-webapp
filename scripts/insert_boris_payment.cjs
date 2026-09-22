const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('--- Processing Boris Brener Grow Payment (175551443) ---');
  
  const payload = {
    id: 'grow_175551443',
    reference_id: '175551443',
    customer_name: 'בוריס ברנר',
    customer_phone: '0545970156',
    customer_email: 'brener1985@gmail.com',
    amount: 2220,
    payment_method: 'Bit (Mastercard...5407)',
    raw_email_snippet: 'היי מגדל דנילוב בע"מ, שבוצע תשלום של 2220 ש"ח. ממי התשלום: בוריס ברנר, טלפון: 0545970156, מייל: brener1985@gmail.com, אמצעי: Bit, אסמכתא: 175551443, עבור: הריזורט לכלב',
    status: 'completed'
  };

  const { data: gData, error: gErr } = await supabase
    .from('grow_incoming_payments')
    .upsert(payload, { onConflict: 'id' })
    .select();

  console.log('grow_incoming_payments result:', gData, 'error:', gErr);

  // Check if Boris Brener has a booking or customer in Supabase
  const { data: bData } = await supabase
    .from('bookings')
    .select('*')
    .or('owner_phone.ilike.%5970156%,owner_name.ilike.%בוריס%,owner_name.ilike.%ברנר%');
  
  console.log('Matching bookings:', bData);

  const { data: cData } = await supabase
    .from('customers')
    .select('*')
    .or('phone.ilike.%5970156%,name.ilike.%בוריס%,name.ilike.%ברנר%');

  console.log('Matching customers:', cData);
}

run();

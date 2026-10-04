const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixNiva() {
  const { data: bookings } = await supabase.from('bookings').select('*').ilike('owner_name', '%ניבה%');
  if (!bookings || bookings.length === 0) return console.log('No booking found');

  const b = bookings[0];
  const curData = b.data || {};

  const updatedData = {
    ...curData,
    depositAmount: 360,
    totalPrice: 3780,
    paymentStatus: 'deposit_paid',
    paymentMethod: 'bit',
    notes: 'מקדמת שריון בסך ₪360 שולמה ב-Bit (אסמכתא 554341 / 176637167). יתרת תשלום בסך ₪3,420 לתשלום בריזורט.'
  };

  const { error } = await supabase.from('bookings').update({
    deposit_amount: 360,
    total_price: 3780,
    payment_status: 'deposit_paid',
    payment_method: 'bit',
    notes: updatedData.notes,
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', b.id);

  console.log('Fixed Niva booking result:', { error });
}

fixNiva();

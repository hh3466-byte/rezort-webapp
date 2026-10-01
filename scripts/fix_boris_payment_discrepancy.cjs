const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateBorisBooking() {
  console.log('Fetching Boris booking...');
  const { data: rows, error: fetchErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', 'b-1790047289926');

  if (fetchErr || !rows || rows.length === 0) {
    console.error('Could not find Boris booking:', fetchErr);
    return;
  }

  const boris = rows[0];
  const curData = boris.data || {};

  const updatedNotes = 'שולם ₪2220 ב-Bit דרך Grow (אסמכתא 175551443, כרטיס 5407). תקופה ראשונה (22/09 עד 08/10) שולמה במלואה. שהות הוארכה עד 15.10.26 (עודכן מוואטסאפ מנהל). נותרה יתרה לתשלום: ₪1,050 עבור 7 ימי הארכה.';

  const updatePayload = {
    total_price: 3270,
    deposit_amount: 2220,
    payment_status: 'partial',
    notes: updatedNotes,
    data: {
      ...curData,
      totalPrice: 3270,
      depositAmount: 2220,
      paymentStatus: 'partial',
      notes: updatedNotes,
      updatedAt: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };

  const { error: updateErr } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', 'b-1790047289926');

  if (updateErr) {
    console.error('Update error:', updateErr);
  } else {
    console.log('Successfully updated Boris booking in Supabase!');
    console.log('New State:', {
      total_price: 3270,
      deposit_amount: 2220,
      debt: 3270 - 2220,
      payment_status: 'partial'
    });
  }
}

updateBorisBooking();

const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function fixTamarAndGrow() {
  console.log('1. Updating Tamar / Lady booking...');
  const { data: currentB } = await supabase.from('bookings').select('*').eq('id', 'b-1792415077707').single();
  if (!currentB) {
    console.error('Booking not found');
    return;
  }

  const bData = currentB.data || {};
  bData.dogName = 'ליידי';
  bData.paymentMethod = 'bit';
  bData.notes = '[💬 פנייה חדשה מוואטסאפ] | שולם במלואו ₪360 ב-Bit דרך Grow ע"י קובי חלה (052-3679637)';

  const { error: bErr } = await supabase.from('bookings').update({
    dog_name: 'ליידי',
    payment_method: 'bit',
    payment_status: 'fully_paid',
    notes: '[💬 פנייה חדשה מוואטסאפ] | שולם במלואו ₪360 ב-Bit דרך Grow ע"י קובי חלה (052-3679637)',
    data: bData,
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1792415077707');

  if (bErr) {
    console.error('Error updating booking:', bErr);
  } else {
    console.log('✓ Successfully updated booking for Lady (Tamar)!');
  }

  console.log('2. Inserting Grow payment into grow_incoming_payments...');
  const { error: gErr } = await supabase.from('grow_incoming_payments').upsert({
    id: 'grow_kobi_chala_191026_360',
    reference_id: 'grow_kobi_chala_360',
    customer_name: 'קובי חלה (תמר גננית עם חיוך - ליידי)',
    customer_phone: '0523679637',
    amount: 360,
    payment_method: 'Bit',
    raw_email_snippet: 'בוצע תשלום עבור בעל העסק - קובי חלה עבור ליידי (תמר גננית עם חיוך) סך ₪360 ב-Bit דרך Grow',
    status: 'completed',
    created_at: '2026-10-19T12:44:00+00:00',
    updated_at: new Date().toISOString()
  });

  if (gErr) {
    console.error('Error inserting grow payment:', gErr);
  } else {
    console.log('✓ Successfully recorded Grow payment for Kobi Chala (₪360)!');
  }
}

fixTamarAndGrow();

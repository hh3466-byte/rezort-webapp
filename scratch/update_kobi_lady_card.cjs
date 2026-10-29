const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function updateKobiBooking() {
  console.log('1. Updating booking b-1792415077707 for Kobi Chala...');
  const { data: b } = await supabase.from('bookings').select('*').eq('id', 'b-1792415077707').single();
  if (!b) {
    console.error('Booking not found!');
    return;
  }

  const bData = b.data || {};
  bData.ownerName = 'קובי חלה';
  bData.ownerPhone = '052-3679637';
  bData.totalPrice = 580;
  bData.depositAmount = 360;
  bData.paymentStatus = 'deposit_paid';
  bData.paymentMethod = 'bit';
  bData.notes = 'ליידי של קובי חלה | שולם מקדמה ₪360 ב-Bit דרך Grow | יתרה לתשלום ₪220 עבור יום נוסף (₪180) + אמפולה (₪40) [סקר_נשלח]';

  const { error: bErr } = await supabase.from('bookings').update({
    owner_name: 'קובי חלה',
    owner_phone: '052-3679637',
    total_price: 580,
    deposit_amount: 360,
    payment_status: 'deposit_paid',
    payment_method: 'bit',
    notes: 'ליידי של קובי חלה | שולם מקדמה ₪360 ב-Bit דרך Grow | יתרה לתשלום ₪220 עבור יום נוסף (₪180) + אמפולה (₪40) [סקר_נשלח]',
    data: bData,
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1792415077707');

  if (bErr) {
    console.error('Error updating booking:', bErr);
  } else {
    console.log('✓ Successfully updated Lady booking to Kobi Chala with 220 NIS debt!');
  }

  console.log('2. Dismissing sandbox payment grow_560094...');
  const { error: gErr } = await supabase.from('grow_incoming_payments').update({
    status: 'dismissed',
    raw_email_snippet: 'סומן כמבוטל (סימולציית Sandbox של ₪220 מתמר)',
    updated_at: new Date().toISOString()
  }).eq('id', 'grow_560094');

  if (gErr) {
    console.error('Error dismissing grow_560094:', gErr);
  } else {
    console.log('✓ Successfully dismissed grow_560094!');
  }
}

updateKobiBooking();

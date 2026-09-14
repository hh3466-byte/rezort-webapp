const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateYaniv() {
  const { data: b, error: fetchErr } = await supabase.from('bookings').select('*').eq('id', 'b-1789375151476').single();
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  console.log('Current booking for Yaniv:', b.dog_name, b.owner_name, b.total_price, b.deposit_amount, b.payment_status);

  // Update payment: deposit 90 paid
  const updatedData = {
    ...b.data,
    depositAmount: 90,
    paymentStatus: 'deposit_paid',
    stayStatus: 'confirmed',
    notes: (b.notes || '') + ' | שולמה מקדמה ₪90 ב-Grow (חשבונית מס/קבלה מורנינג עבור הריזורט לכלב)'
  };

  const { error: upErr } = await supabase.from('bookings').update({
    deposit_amount: 90,
    payment_status: 'deposit_paid',
    stay_status: 'confirmed',
    notes: updatedData.notes,
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1789375151476');

  console.log('Booking update result:', upErr ? upErr : 'SUCCESS');

  // Insert into grow_incoming_payments
  const growRecord = {
    id: 'grow_yaniv_django_90',
    reference_id: 'yaniv_grow_90',
    customer_name: 'יניב אל',
    customer_phone: b.owner_phone,
    customer_email: b.owner_email || '',
    amount: 90,
    payment_method: 'Grow / Bit',
    raw_email_snippet: 'בוצע תשלום עבור בעל העסק - היי מגדל דנילוב בעמ, אנחנו שמחים לעדכן אותך שבוצע תשלום של 90 שח עבור הריזורט לכלב (גנגו)',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error: gErr } = await supabase.from('grow_incoming_payments').upsert(growRecord, { onConflict: 'id' });
  console.log('Grow record upsert result:', gErr ? gErr : 'SUCCESS');

  // Check customer profile for Yaniv
  const cleanPhone = b.owner_phone.replace(/\D/g, '');
  const { data: cust } = await supabase.from('customers').select('*').eq('phone', b.owner_phone).maybeSingle();
  if (cust) {
    await supabase.from('customers').update({
      total_spent: (Number(cust.total_spent) || 0) + 90,
      updated_at: new Date().toISOString()
    }).eq('id', cust.id);
    console.log('Customer total_spent updated');
  }
}

updateYaniv();

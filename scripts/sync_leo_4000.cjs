const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('=== מסנכרן תשלום 4,000 ₪ של לי דלויה (ליאו) ===');

  // 1. Fetch current booking
  const { data: b, error: fErr } = await supabase.from('bookings').select('*').eq('id', 'b-1791271522477').single();
  if (fErr || !b) {
    console.error('Booking not found:', fErr);
    return;
  }

  const newNotes = (b.notes || '') + ' | יתרת תשלום סך ₪4,000 הוסדרה במלואה ב-Grow (קבלה/חשבונית 6506) - שולם 100% ✅';
  const updatedData = {
    ...b.data,
    depositAmount: 6000,
    totalPrice: 6000,
    paymentStatus: 'fully_paid',
    notes: newNotes,
    updatedAt: new Date().toISOString()
  };

  // 2. Update booking in Supabase
  const { error: bErr } = await supabase.from('bookings').update({
    deposit_amount: 6000,
    payment_status: 'fully_paid',
    notes: newNotes,
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1791271522477');

  if (bErr) {
    console.error('Error updating booking:', bErr);
    return;
  }
  console.log('✓ שהיית ליאו עודכנה בהצלחה ל-שולם במלואו (6,000 ₪)!');

  // 3. Insert Grow incoming payment
  const growPayload = {
    id: 'grow_6506_manual_sync',
    reference_id: '6506_grow_payment',
    customer_name: 'לי דלויה',
    customer_phone: '0526340385',
    customer_email: 'leedaluoya@gmail.com',
    amount: 4000,
    payment_method: 'Grow / אשראי',
    raw_email_snippet: 'תשלום יתרה ע״ס 4,000 ₪ עבור ליאו (אילוף פנסיון) - חשבונית מס/קבלה 6506',
    status: 'completed'
  };

  const { error: gErr } = await supabase.from('grow_incoming_payments').upsert(growPayload, { onConflict: 'id' });
  if (gErr) {
    console.error('Error inserting grow payment:', gErr);
  } else {
    console.log('✓ תשלום ה-4,000 ₪ נרשם בהצלחה בטבלת grow_incoming_payments!');
  }

  // 4. Send WhatsApp notifications to Hagai and Shmulik
  const alertMsg = 'שלום, התקבל תשלום ע״ס 4,000 ₪ מלי דלויה בעבור ליאו על שירות אילוף (תשלום מלא).';
  const greenId = '710722735421';
  const greenToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const recipients = ['972543200007@c.us', '972506336896@c.us'];

  for (const r of recipients) {
    try {
      const res = await fetch('https://api.green-api.com/waInstance' + greenId + '/sendMessage/' + greenToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: r, message: alertMsg })
      });
      const resData = await res.json();
      console.log('✓ הודעת וואטסאפ נשלחה אל ' + r + ':', resData);
    } catch (eWa) {
      console.error('WhatsApp send error for ' + r + ':', eWa);
    }
  }

  console.log('=== הסנכרון הושלם בהצלחה! ===');
}

run();

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:/Projects/הריזורט לכלב/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function markOrlyPaidNow() {
  console.log('=== UPDATING ORLY WIENER / SHELEGI BOOKING TO FULLY PAID ===');
  
  const bookingId = 'b-1792311170175';

  // 1. Fetch current booking
  const { data: bRows } = await supabase.from('bookings').select('*').eq('id', bookingId);
  const currentB = bRows?.[0];
  if (!currentB) {
    console.error('Booking not found!');
    return;
  }

  const currentData = currentB.data || {};
  delete currentData.refundDate;
  delete currentData.refundNotes;
  delete currentData.refundReason;
  delete currentData.refundAmount;

  const updatedData = {
    ...currentData,
    depositAmount: 360,
    totalPrice: 360,
    paymentStatus: 'fully_paid',
    paymentMethod: 'bit',
    stayStatus: 'booked',
    growPaymentVerified: true,
    lastPaymentReceivedAt: '2026-10-18T11:14:00+03:00',
    notes: (currentB.notes || '') + ' | [💰 שולם במלואו ₪360 ב-Bit דרך Grow בתאריך 18.10.26 11:14]'
  };

  const { error: bErr } = await supabase.from('bookings').update({
    deposit_amount: 360,
    total_price: 360,
    payment_status: 'fully_paid',
    payment_method: 'bit',
    stay_status: 'booked',
    notes: updatedData.notes,
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', bookingId);

  if (bErr) {
    console.error('Booking update error:', bErr);
  } else {
    console.log('✓ Booking b-1792311170175 updated to fully_paid (₪360)!');
  }

  // 2. Insert into grow_incoming_payments
  const paymentRecord = {
    id: `grow_orly_${Date.now()}`,
    reference_id: `grow_orly_181026_1114`,
    customer_name: 'אורלי וינר (שילגי)',
    customer_phone: '0523077737',
    customer_email: 'orlyweiner@gmail.com',
    amount: 360,
    payment_method: 'Bit',
    raw_email_snippet: 'בוצע תשלום עבור בעל העסק - אורלי וינר (שילגי) סך ₪360 ב-Bit',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error: pErr } = await supabase.from('grow_incoming_payments').upsert(paymentRecord);
  if (pErr) {
    console.error('grow_incoming_payments upsert error:', pErr);
  } else {
    console.log('✓ Recorded in grow_incoming_payments table!');
  }
}

markOrlyPaidNow().catch(console.error);

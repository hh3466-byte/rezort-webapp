const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateBoss() {
  const updatedNotes = 'אילוף פנסיון - עלות כוללת ₪6,500 | שולם במלואו (100%): ₪200 מקדמה ע״י אריאל שרייבר + ₪2,000 ע״י איתי אהרונסון באשראי Grow (אסמכתא 4900844785) + ₪4,300 ע״י איתי אהרונסון ב-Gpay (אסמכתא 4936821879) | שולם במלואו ✅';

  // 1. Update Booking
  const { data: bData, error: bErr } = await supabase.from('bookings').update({
    deposit_amount: 6500,
    payment_status: 'fully_paid',
    payment_method: 'credit_card',
    notes: updatedNotes,
    data: {
      id: 'b-1789732108163',
      dogName: 'בוס',
      ownerName: 'איתי אהרונסון',
      ownerPhone: '0543044647',
      ownerEmail: 'itay3044647@gmail.com',
      serviceType: 'training',
      startDate: '2026-10-02',
      endDate: '2026-11-16',
      totalPrice: 6500,
      depositAmount: 6500,
      paymentStatus: 'fully_paid',
      paymentMethod: 'credit_card',
      stayStatus: 'booked',
      vaccinationValid: true,
      notes: updatedNotes
    },
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1789732108163');

  if (bErr) console.error('Booking update error:', bErr);
  else console.log('Boss booking updated to fully paid (6,500 ₪)!');

  // 2. Upsert Grow Payment Record
  const { error: gErr } = await supabase.from('grow_incoming_payments').upsert({
    id: 'grow_4936821879',
    reference_id: '4936821879',
    customer_name: 'איתי אהרונסון',
    customer_phone: '0543044647',
    customer_email: 'itay3044647@gmail.com',
    amount: 4300,
    payment_method: 'Gpay אשראי: 9219',
    raw_email_snippet: 'תשלום של 4300 ש"ח ב-Gpay עבור הריזורט לכלב (אסמכתא 4936821879)',
    status: 'completed'
  }, { onConflict: 'id' });

  if (gErr) console.error('Grow insert error:', gErr);
  else console.log('Grow payment recorded: 4,300 ₪ for Itay Aharonson!');
}
updateBoss();

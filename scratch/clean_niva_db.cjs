const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function fix() {
  console.log('1. Deleting bogus grow payments for Niva...');
  const { error: delErr } = await supabase.from('grow_incoming_payments').delete().in('id', ['grow_176637167', 'grow_554341']);
  console.log('Delete result:', delErr ? delErr.message : 'OK');

  console.log('2. Updating Niva booking to deposit: 0, status: unpaid...');
  const { data: nivaBookings } = await supabase.from('bookings').select('*').ilike('owner_name', '%ניבה%');
  for (const b of (nivaBookings || [])) {
    const curData = b.data || {};
    const updatedData = {
      ...curData,
      depositAmount: 0,
      paymentStatus: 'unpaid',
      notes: 'המקום משוריין לשטוץ ודודו. מקדמה ₪360 טרם שולמה (יתרה: ₪3,780).'
    };
    const { error: upErr } = await supabase.from('bookings').update({
      deposit_amount: 0,
      payment_status: 'unpaid',
      notes: updatedData.notes,
      data: updatedData,
      updated_at: new Date().toISOString()
    }).eq('id', b.id);
    console.log(`Updated booking ${b.id}:`, upErr ? upErr.message : 'OK');
  }
}
fix();

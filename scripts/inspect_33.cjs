const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testOne() {
  const item = { ref: '507807309', paid: 1000, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי", service: 'boarding' };
  const bookingId = `b-grow-${item.ref}`;
  const payload = {
    id: bookingId,
    dog_name: item.dog,
    dog_breed: 'מעורב',
    owner_name: item.name,
    owner_phone: item.phone,
    owner_email: item.email || '',
    service_type: item.service || 'boarding',
    start_date: item.date,
    end_date: item.date,
    total_price: item.paid,
    deposit_amount: item.paid,
    payment_status: 'fully_paid',
    payment_method: 'bit',
    stay_status: 'completed',
    notes: `תשלום סולק Grow (אסמכתא: ${item.ref})`,
    vaccination_valid: true,
    created_at: `${item.date}T10:00:00.000Z`,
    updated_at: `${item.date}T10:00:00.000Z`,
    data: { id: bookingId }
  };

  console.log('Upserting...');
  const res = await supabase.from('bookings').upsert(payload, { onConflict: 'id' }).select();
  console.log('Upsert res:', { error: res.error, dataLen: res.data ? res.data.length : null, status: res.status });

  console.log('Now waiting 1 second...');
  await new Promise(r => setTimeout(r, 1000));
  const q1 = await supabase.from('bookings').select('id').eq('id', bookingId);
  console.log('Query at 1s:', q1.data);

  console.log('Now waiting 3 seconds...');
  await new Promise(r => setTimeout(r, 3000));
  const q2 = await supabase.from('bookings').select('id').eq('id', bookingId);
  console.log('Query at 4s:', q2.data);
}

testOne();

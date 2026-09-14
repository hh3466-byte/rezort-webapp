const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('1. Querying before insert:');
  const b1 = await supabase.from('bookings').select('id');
  console.log('Count before:', b1.data.length);

  const testId = 'b-grow-507807309';
  const item = {
    id: testId,
    dog_name: "ג'וי",
    dog_breed: 'מעורב',
    owner_name: 'ירוס ביקאיה',
    owner_phone: '0556646093',
    owner_email: 'yerusbikaya54@gmail.com',
    service_type: 'boarding',
    start_date: '2026-08-11',
    end_date: '2026-08-11',
    total_price: 1000,
    deposit_amount: 1000,
    payment_status: 'fully_paid',
    payment_method: 'bit',
    stay_status: 'completed',
    notes: 'תשלום סולק Grow (אסמכתא: 507807309)',
    vaccination_valid: true,
    created_at: '2026-08-11T10:00:00.000Z',
    updated_at: '2026-08-11T10:00:00.000Z',
    data: {
      id: testId,
      dogName: "ג'וי",
      dogBreed: 'מעורב',
      ownerName: 'ירוס ביקאיה',
      ownerPhone: '0556646093',
      ownerEmail: 'yerusbikaya54@gmail.com',
      serviceType: 'boarding',
      startDate: '2026-08-11',
      endDate: '2026-08-11',
      totalPrice: 1000,
      depositAmount: 1000,
      paymentStatus: 'fully_paid',
      paymentMethod: 'bit',
      stayStatus: 'completed',
      notes: 'תשלום סולק Grow (אסמכתא: 507807309)',
      createdAt: '2026-08-11T10:00:00.000Z',
      updatedAt: '2026-08-11T10:00:00.000Z'
    }
  };

  console.log('2. Inserting test item...');
  const insertRes = await supabase.from('bookings').upsert(item, { onConflict: 'id' }).select();
  console.log('Insert error:', insertRes.error);
  console.log('Insert returned data:', insertRes.data ? insertRes.data.length : null);

  console.log('3. Querying immediately after insert:');
  const b2 = await supabase.from('bookings').select('id, owner_name, total_price').eq('id', testId);
  console.log('Found inserted row?', b2.data);

  const b3 = await supabase.from('bookings').select('id');
  console.log('Count after:', b3.data.length);
}

main();

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const missing = [
    { ref: '507807309', paid: 1000, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', dog: "ג'וי" },
    { ref: '507806497', paid: 3000, phone: '0556646093', email: 'yerusbikaya54@gmail.com', name: 'ירוס ביקאיה', date: '2026-08-11', dog: "ג'וי" },
    { ref: '508390101', paid: 180, phone: '0524577752', email: 'ziviisme@gmail.com', name: 'זיו זיסו', date: '2026-08-13', dog: 'זיסו' }
  ];

  for (const item of missing) {
    const bookingId = 'b-grow-' + item.ref;
    const payload = {
      id: bookingId,
      dog_name: item.dog,
      dog_breed: 'מעורב',
      owner_name: item.name,
      owner_phone: item.phone,
      owner_email: item.email,
      service_type: item.paid >= 4000 ? 'training' : (item.paid <= 360 ? 'daycare' : 'boarding'),
      start_date: item.date,
      end_date: item.date,
      total_price: item.paid,
      deposit_amount: item.paid,
      payment_status: 'fully_paid',
      payment_method: 'bit',
      stay_status: 'completed',
      notes: 'תשלום סולק Grow (אסמכתא: ' + item.ref + ')',
      vaccination_valid: true,
      created_at: item.date + 'T10:00:00.000Z',
      updated_at: item.date + 'T10:00:00.000Z',
      data: {
        id: bookingId,
        dogName: item.dog,
        dogBreed: 'מעורב',
        ownerName: item.name,
        ownerPhone: item.phone,
        ownerEmail: item.email,
        serviceType: item.paid >= 4000 ? 'training' : (item.paid <= 360 ? 'daycare' : 'boarding'),
        startDate: item.date,
        endDate: item.date,
        totalPrice: item.paid,
        depositAmount: item.paid,
        paymentStatus: 'fully_paid',
        paymentMethod: 'bit',
        stayStatus: 'completed',
        notes: 'תשלום סולק Grow (אסמכתא: ' + item.ref + ')',
        vaccinationValid: true,
        createdAt: item.date + 'T10:00:00.000Z',
        updatedAt: item.date + 'T10:00:00.000Z'
      }
    };

    const res = await supabase.from('bookings').upsert(payload, { onConflict: 'id' });
    console.log('Result for', bookingId, res.error ? 'ERROR: ' + JSON.stringify(res.error) : 'SUCCESS');
  }
}

testInsert();

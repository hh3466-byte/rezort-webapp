const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function createBorisBooking() {
  console.log('--- Creating Booking for Boris Brener & Dog Mike ---');

  const bookingId = `b-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const bookingData = {
    id: bookingId,
    dogName: "מייק",
    dogBreed: "מלמוט",
    dogGender: "male_neutered",
    dogAgeGroup: "adult",
    ownerName: "בוריס ברנר",
    ownerPhone: "0545970156",
    ownerEmail: "brener1985@gmail.com",
    serviceType: "boarding",
    startDate: "2026-09-22",
    endDate: "2026-10-08",
    pricingMode: "daily",
    dailyRate: 138.75,
    totalPrice: 2220,
    depositAmount: 2220,
    paymentStatus: "fully_paid",
    paymentMethod: "bit",
    stayStatus: "booked",
    arrivalTime: "09:00 - 11:00",
    pickupTime: "17:00 - 19:00",
    notes: 'שולם ₪2220 ב-Bit דרך Grow (אסמכתא 175551443, כרטיס 5407). מגיע היום 22/09 עד 08/10',
    vaccinationValid: true,
    crateTrained: true,
    isFreeStay: false,
    extraServices: [],
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const dbRow = {
    id: bookingId,
    dog_name: "מייק",
    dog_breed: "מלמוט",
    dog_gender: "male_neutered",
    dog_age_group: "adult",
    owner_name: "בוריס ברנר",
    owner_phone: "0545970156",
    owner_email: "brener1985@gmail.com",
    service_type: "boarding",
    start_date: "2026-09-22",
    end_date: "2026-10-08",
    total_price: 2220,
    deposit_amount: 2220,
    payment_status: "fully_paid",
    payment_method: "bit",
    stay_status: "booked",
    notes: 'שולם ₪2220 ב-Bit דרך Grow (אסמכתא 175551443, כרטיס 5407). מגיע היום 22/09 עד 08/10',
    vaccination_valid: true,
    crate_trained: true,
    arrival_time: "09:00 - 11:00",
    pickup_time: "17:00 - 19:00",
    data: bookingData,
    created_at: nowIso,
    updated_at: nowIso
  };

  const { data: bRes, error: bErr } = await supabase
    .from('bookings')
    .insert(dbRow)
    .select();

  console.log('Booking Insert Result:', bRes, 'error:', bErr);

  // Also ensure customer is saved
  const customerRow = {
    id: `c-${Date.now()}`,
    name: "בוריס ברנר",
    phone: "0545970156",
    email: "brener1985@gmail.com",
    dog_name: "מייק",
    dog_breed: "מלמוט",
    created_at: nowIso,
    updated_at: nowIso
  };

  await supabase.from('customers').upsert(customerRow, { onConflict: 'phone' });

  // Update grow_incoming_payments status to completed
  await supabase
    .from('grow_incoming_payments')
    .update({ status: 'completed' })
    .eq('reference_id', '175551443');

  console.log('✓ Boris Brener & Mike Booking created successfully and linked to payment!');
}

createBorisBooking();

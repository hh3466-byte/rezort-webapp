const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixKarinBooking() {
  console.log('--- Fixing Karin Lahav Booking ---');
  
  // 1. Restore old booking (17.09-18.09) to original 180 NIS
  const oldBookingId = 'b-1789577679734';
  const { data: oldBooking } = await supabase.from('bookings').select('*').eq('id', oldBookingId).single();
  if (oldBooking) {
    const oldData = oldBooking.data || {};
    await supabase.from('bookings').update({
      deposit_amount: 180,
      total_price: 180,
      notes: "לא מקבל תרופות, כלב רגיש ולפעמים קצת חרדתי | [🐶 לקוח חדש] | [📜 תקנון הריזורט אושר כחוק] | שולם ₪180 [סקר_נשלח]",
      data: {
        ...oldData,
        depositAmount: 180,
        totalPrice: 180,
        notes: "לא מקבל תרופות, כלב רגיש ולפעמים קצת חרדתי | [🐶 לקוח חדש] | [📜 תקנון הריזורט אושר כחוק] | שולם ₪180 [סקר_נשלח]"
      },
      updated_at: new Date().toISOString()
    }).eq('id', oldBookingId);
    console.log('Old booking restored to 180 NIS.');
  }

  // 2. Create the new booking for 22.09.2026 - 25.09.2026
  const newBookingId = `b-${Date.now()}`;
  const newBookingData = {
    id: newBookingId,
    dogName: "שון",
    dogBreed: "מעורב",
    dogGender: "male_neutered",
    dogAgeGroup: "adult",
    ownerName: "קארין להב",
    ownerPhone: "0546610321",
    ownerEmail: "karinlahav23@gmail.com",
    serviceType: "boarding",
    startDate: "2026-09-22",
    endDate: "2026-09-25",
    dailyRate: 180,
    totalPrice: 440,
    depositAmount: 440,
    paymentStatus: "fully_paid",
    paymentMethod: "bit",
    stayStatus: "confirmed",
    pricingMode: "daily",
    isFreeStay: false,
    crateTrained: true,
    arrivalTime: "14:30 - 15:00",
    pickupTime: "17:00 - 19:00",
    notes: "שהות נוכחית (הגיע ב-22.09 סביב 15:00, איסוף משוער 24/25.09) | שולם ₪440 (Bit אשראי: 3706 אסמכתא 175543879) | [💎 לקוח חוזר - הופעלה הטבת VIP 100 ₪]",
    vaccinationValid: true,
    createdAt: "2026-09-20T07:31:47.325Z",
    updatedAt: new Date().toISOString()
  };

  const { error: insErr } = await supabase.from('bookings').insert({
    id: newBookingId,
    dog_name: "שון",
    dog_breed: "מעורב",
    dog_gender: "male_neutered",
    owner_name: "קארין להב",
    owner_phone: "0546610321",
    owner_email: "karinlahav23@gmail.com",
    service_type: "boarding",
    start_date: "2026-09-22",
    end_date: "2026-09-25",
    total_price: 440,
    deposit_amount: 440,
    payment_status: "fully_paid",
    payment_method: "bit",
    stay_status: "confirmed",
    notes: newBookingData.notes,
    vaccination_valid: true,
    data: newBookingData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (insErr) {
    console.error('Insert error:', insErr);
  } else {
    console.log('Successfully inserted new booking for Sean (Karin Lahav) 22-25.09:', newBookingId);
  }
}

fixKarinBooking().catch(console.error);

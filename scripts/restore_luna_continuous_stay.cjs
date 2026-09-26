const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function restoreLuna() {
  const lunaId = 'b-1789361510508';
  
  const updatedBookingData = {
    id: lunaId,
    dogName: 'לונה המתגעגעת',
    dogBreed: 'מעורב',
    dogGender: 'female_spayed',
    ownerName: 'שלומי ממן',
    ownerPhone: '0505445512',
    ownerEmail: 'Shlomi@maman-arc.co.il',
    serviceType: 'training',
    startDate: '2026-05-01',
    endDate: '2027-12-31', // Open-ended continuous stay
    totalPrice: 0,
    dailyRate: 0,
    depositAmount: 0,
    paymentStatus: 'fully_paid',
    paymentMethod: 'bit',
    stayStatus: 'booked',
    isFreeStay: true,
    kennelNumber: 'home',
    vaccinationValid: true,
    notes: 'אירוח ללא תשלום (חינם) | שהות פתוחה ומתמשכת באילוף ללא הגבלת זמן (עד החלטת שלומי)',
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: new Date().toISOString()
  };

  const { error } = await supabase.from('bookings').update({
    dog_name: 'לונה המתגעגעת',
    dog_breed: 'מעורב',
    dog_gender: 'female_spayed',
    owner_name: 'שלומי ממן',
    owner_phone: '0505445512',
    owner_email: 'Shlomi@maman-arc.co.il',
    service_type: 'training',
    start_date: '2026-05-01',
    end_date: '2027-12-31',
    total_price: 0,
    deposit_amount: 0,
    payment_status: 'fully_paid',
    payment_method: 'bit',
    stay_status: 'booked',
    notes: 'אירוח ללא תשלום (חינם) | שהות פתוחה ומתמשכת באילוף ללא הגבלת זמן (עד החלטת שלומי)',
    vaccination_valid: true,
    data: updatedBookingData,
    updated_at: new Date().toISOString()
  }).eq('id', lunaId);

  if (error) {
    console.error('Update error:', error);
    return;
  }

  console.log('✅ Luna successfully restored as active continuous free training stay through 2027!');
  
  // Verify
  const { data: check } = await supabase.from('bookings').select('*').eq('id', lunaId);
  console.log('Verified Booking:', {
    id: check[0].id,
    dog_name: check[0].dog_name,
    owner_name: check[0].owner_name,
    stay_status: check[0].stay_status,
    start_date: check[0].start_date,
    end_date: check[0].end_date,
    dog_gender: check[0].dog_gender,
    is_free: check[0].data?.isFreeStay
  });
}

restoreLuna();

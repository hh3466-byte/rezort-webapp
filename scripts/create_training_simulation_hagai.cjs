const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function createSimulation() {
  const bookingObj = {
    id: 'b-sim-training-hagai',
    dogName: 'רוקי',
    dogBreed: 'רועה מעורב',
    dogAgeGroup: 'young',
    ownerName: 'חגי',
    ownerPhone: '054-3200007',
    serviceType: 'training',
    startDate: '2026-10-12',
    endDate: '2026-11-11',
    totalPrice: 6500,
    depositAmount: 0,
    paymentStatus: 'unpaid',
    paymentMethod: 'credit',
    stayStatus: 'booked',
    vaccinationValid: true,
    isTrainingAgreementSigned: false,
    notes: '[סימולציית אילוף] פנסיון ואילוף מלא (30 יום) - שריון מותנה בחתימה על הסכם',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const payload = {
    id: bookingObj.id,
    dog_name: bookingObj.dogName,
    dog_breed: bookingObj.dogBreed,
    owner_name: bookingObj.ownerName,
    owner_phone: bookingObj.ownerPhone,
    service_type: bookingObj.serviceType,
    start_date: bookingObj.startDate,
    end_date: bookingObj.endDate,
    total_price: bookingObj.totalPrice,
    deposit_amount: bookingObj.depositAmount,
    payment_status: bookingObj.paymentStatus,
    payment_method: bookingObj.paymentMethod,
    stay_status: bookingObj.stayStatus,
    notes: bookingObj.notes,
    vaccination_valid: bookingObj.vaccinationValid,
    data: bookingObj,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('bookings').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Error upserting simulation booking:', error);
  } else {
    console.log('✅ Successfully created training simulation booking for Hagai in Supabase:');
    console.log(JSON.stringify(bookingObj, null, 2));
  }
}

createSimulation().catch(console.error);

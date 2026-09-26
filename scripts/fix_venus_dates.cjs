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

async function fixVenus() {
  console.log('--- Updating Venus booking in Supabase ---');
  
  const record = {
    id: 'b-grow-173090500',
    dog_name: 'ונוס',
    dog_breed: 'מעורב',
    owner_name: 'אלי קובי',
    owner_phone: '0546160220',
    owner_email: 'elikobi@gmail.com',
    service_type: 'boarding',
    start_date: '2026-09-18',
    end_date: '2026-09-27',
    total_price: 1350,
    deposit_amount: 1350,
    payment_status: 'fully_paid',
    payment_method: 'bit',
    stay_status: 'checked_in',
    notes: 'תשלום סולק Grow (אסמכתא: 173090500) | תאריכי שהות: 18/09/2026 עד 27/09/2026 (איש קשר נוסף: יפעת 054-4998242)',
    vaccination_valid: true,
    data: {
      id: 'b-grow-173090500',
      dogName: 'ונוס',
      dogBreed: 'מעורב',
      ownerName: 'אלי קובי',
      ownerPhone: '0546160220',
      ownerEmail: 'elikobi@gmail.com',
      serviceType: 'boarding',
      startDate: '2026-09-18',
      endDate: '2026-09-27',
      totalPrice: 1350,
      depositAmount: 1350,
      paymentStatus: 'fully_paid',
      paymentMethod: 'bit',
      stayStatus: 'checked_in',
      notes: 'תשלום סולק Grow (אסמכתא: 173090500) | תאריכי שהות: 18/09/2026 עד 27/09/2026 (איש קשר נוסף: יפעת 054-4998242)',
      vaccinationValid: true,
      updatedAt: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('bookings')
    .upsert(record);

  console.log('Update result:', data, error);
}

fixVenus();

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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

async function fixGalBooking() {
  const { data: current } = await supabase.from('bookings').select('*').eq('id', 'b-1788370908724').single();
  if (!current) {
    console.log('Booking b-1788370908724 not found');
    return;
  }

  console.log('Current booking before fix:', current.dog_name, current.start_date, current.end_date, current.total_price, current.deposit_amount);

  const updatedData = {
    ...(current.data || {}),
    id: 'b-1788370908724',
    dogName: 'אוניל',
    dogBreed: 'מעורב',
    ownerName: 'גל שרה שמש בן יוסף',
    ownerPhone: '0522458841',
    ownerEmail: 'benyosefgal@gmail.com',
    serviceType: 'boarding',
    startDate: '2026-09-27',
    endDate: '2026-09-29',
    totalPrice: 288,
    depositAmount: 288,
    paymentStatus: 'fully_paid',
    stayStatus: 'booked',
    notes: 'פנסיון 27/09-29/09 | שולם במלואו ₪288 דרך Grow (מקדמה ₪180 אסמכתא 4857277218 + השלמה ₪108 אסמכתא 4888806968)',
    updatedAt: new Date().toISOString()
  };

  const { error } = await supabase.from('bookings').update({
    service_type: 'boarding',
    start_date: '2026-09-27',
    end_date: '2026-09-29',
    total_price: 288,
    deposit_amount: 288,
    payment_status: 'fully_paid',
    stay_status: 'booked',
    notes: updatedData.notes,
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1788370908724');

  if (error) {
    console.error('Error updating booking:', error);
  } else {
    console.log('✓ Successfully updated Gal Shemesh booking to 27/09/2026 - 29/09/2026 in Supabase!');
  }
}

fixGalBooking();

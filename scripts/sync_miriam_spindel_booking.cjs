const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function syncMiriam() {
  const { data: cfg } = await supabase.from('settings').select('*').limit(1);
  const settings = cfg?.[0]?.data || cfg?.[0] || {};
  const intakes = settings.intakeRequests || [];
  const miriamIntake = intakes.find(i => i.id === 'req-1791895754861');
  
  if (!miriamIntake) {
    console.error('Miriam intake not found');
    return;
  }

  console.log('Found Miriam intake:', miriamIntake.id, miriamIntake.ownerName, miriamIntake.dogName);

  // 1. Create Booking in Supabase
  const bookingId = 'b-' + miriamIntake.id.replace('req-', '');
  const noteText = (miriamIntake.notes || '') + ' | שולם במלואו ₪800 ב-Grow (2 תשלומים של ₪400 ע"י אלון ספינדל 054-5705976)';

  const bookingPayload = {
    id: bookingId,
    dog_name: miriamIntake.dogName || 'פיבי',
    dog_breed: miriamIntake.dogBreed || 'מעורב',
    dog_gender: miriamIntake.dogGender || 'female',
    owner_name: miriamIntake.ownerName || 'מרים אור בן חמו',
    owner_phone: miriamIntake.ownerPhone || '052-2736633',
    owner_email: miriamIntake.ownerEmail || 'miriam.benhamu@gmail.com',
    service_type: 'boarding',
    start_date: miriamIntake.startDate || '2026-10-15',
    end_date: miriamIntake.endDate || '2026-10-19',
    total_price: 800,
    deposit_amount: 800,
    payment_status: 'fully_paid',
    payment_method: 'credit_card',
    stay_status: 'confirmed',
    vaccination_valid: true,
    notes: noteText,
    data: {
      id: bookingId,
      dogName: miriamIntake.dogName || 'פיבי',
      dogBreed: miriamIntake.dogBreed || 'מעורב',
      dogGender: miriamIntake.dogGender || 'female',
      ownerName: miriamIntake.ownerName || 'מרים אור בן חמו',
      ownerPhone: miriamIntake.ownerPhone || '052-2736633',
      ownerEmail: miriamIntake.ownerEmail || 'miriam.benhamu@gmail.com',
      serviceType: 'boarding',
      startDate: miriamIntake.startDate || '2026-10-15',
      endDate: miriamIntake.endDate || '2026-10-19',
      totalPrice: 800,
      depositAmount: 800,
      paymentStatus: 'fully_paid',
      paymentMethod: 'credit_card',
      stayStatus: 'confirmed',
      vaccinationValid: true,
      pricingMode: 'daily',
      dailyRate: 200,
      notes: noteText,
      specialDiet: miriamIntake.specialNeeds || '',
      ownerAddress: miriamIntake.ownerAddress || '',
      intakeRequestId: miriamIntake.id,
      payerName: 'אלון ספינדל',
      payerPhone: '054-5705976',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error: bErr } = await supabase.from('bookings').upsert(bookingPayload, { onConflict: 'id' });
  if (bErr) {
    console.error('Error creating booking:', bErr);
    return;
  }
  console.log('✓ הזמנה נוצרה בהצלחה ביומן עבור פיבי (מרים בן אור חמו) על סך 800 ₪!');

  // 2. Insert into grow_incoming_payments
  const growPayload = {
    id: 'grow_spindel_400_800',
    reference_id: 'grow_spindel_131026',
    customer_name: 'אלון ספינדל (מרים אור בן חמו)',
    customer_phone: '0545705976',
    customer_email: 'miriam.benhamu@gmail.com',
    amount: 800,
    payment_method: 'Grow / אשראי (2 תשלומים של ₪400)',
    raw_email_snippet: 'תשלום עבור פיבי (הריזורט לכלב) - 2 תשלומים של 400 ₪ מאת אלון ספינדל 054-5705976',
    status: 'completed'
  };

  const { error: gErr } = await supabase.from('grow_incoming_payments').upsert(growPayload, { onConflict: 'id' });
  if (gErr) {
    console.error('Grow insert error:', gErr);
  } else {
    console.log('✓ עסקת Grow סונכרנה בהצלחה בטבלת grow_incoming_payments!');
  }

  // 3. Update intake status to 'approved'
  miriamIntake.status = 'approved';
  miriamIntake.notes = (miriamIntake.notes || '') + ' | [אושר ושולם ₪800 ע"י אלון ספינדל 054-5705976]';
  settings.intakeRequests = intakes;
  
  const { error: sErr } = await supabase.from('settings').update({
    data: settings,
    updated_at: new Date().toISOString()
  }).eq('id', 'resort_config');

  if (sErr) {
    console.error('Settings update error:', sErr);
  } else {
    console.log('✓ שאלון הקליטה עודכן לסטטוס approved!');
  }
}

syncMiriam().catch(console.error);

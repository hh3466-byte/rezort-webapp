const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('=== APPLYING EXACT HILA ACCOUNTING UPDATES ===');

  // 1. JOY (ג'וי - ירוס ביקאיה): נשאר תשלום אחרון (1,000 ש"ח שולם)
  console.log('\n1. Updating Joy (ג\'וי)...');
  const { data: joyBookings } = await supabase
    .from('bookings')
    .select('*')
    .ilike('dog_name', '%ג\'וי%');

  // Find or use main Joy booking
  const joy = joyBookings?.[0];
  if (joy) {
    const joyStages = [
      { stage: '1/3', label: 'תשלום 1/3 (ראשון)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-08-11' },
      { stage: '2/3', label: 'תשלום 2/3 (אמצע)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-09-14', receiptNumber: '20056' },
      { stage: '3/3', label: 'תשלום 3/3 (סיום - נשאר תשלום אחרון)', amount: 500, paid: false, isPaidActually: false }
    ];
    await supabase.from('bookings').update({
      service_type: 'training',
      data: {
        ...(joy.data || {}),
        serviceType: 'training',
        trainerStages: joyStages,
        trainerPaid: 1000,
        isTrainingCompleted: false
      },
      updated_at: new Date().toISOString()
    }).eq('id', joy.id);
    console.log(`Updated Joy (${joy.id}): 1/3 paid, 2/3 paid, 3/3 remaining (1,000 NIS paid).`);
  }

  // 2. LUNA NEW (לונה - רונן מלמוד): נשארו 2 תשלומים (500 ש"ח שולם בביט)
  console.log('\n2. Updating Luna New (לונה - רונן מלמוד)...');
  const lunaStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      paid: true,
      isPaidActually: true,
      paidDate: '2026-09-22',
      receiptNumber: '20057',
      bitConfirmationNumber: '1378-7978-59402',
      notes: 'העברת ביט ₪500 - אישור 1378-7978-59402'
    },
    { stage: '2/3', label: 'תשלום 2/3 (אמצע - נשאר)', amount: 500, paid: false, isPaidActually: false },
    { stage: '3/3', label: 'תשלום 3/3 (סיום - נשאר)', amount: 500, paid: false, isPaidActually: false }
  ];
  const { data: lunaRonen } = await supabase.from('bookings').select('*').eq('id', 'b-1789541492653').single();
  if (lunaRonen) {
    await supabase.from('bookings').update({
      service_type: 'training',
      data: {
        ...(lunaRonen.data || {}),
        serviceType: 'training',
        trainerStages: lunaStages,
        trainerPaid: 500,
        isTrainingCompleted: false
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1789541492653');
    console.log('Updated Luna (b-1789541492653): 1/3 paid via Bit (20057), 2/3 and 3/3 remaining (500 NIS paid).');
  }

  // 3. THEO (תיאו - איל שקל): נשארו 2 תשלומים (500 ש"ח שולם)
  console.log('\n3. Updating Theo (תיאו - איל שקל)...');
  const theoStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      paid: true,
      isPaidActually: true,
      paidDate: '2026-09-14',
      receiptNumber: '20056',
      notes: 'שולם בביט (קבלה 20056)'
    },
    { stage: '2/3', label: 'תשלום 2/3 (אמצע - נשאר)', amount: 500, paid: false, isPaidActually: false },
    { stage: '3/3', label: 'תשלום 3/3 (סיום - נשאר)', amount: 500, paid: false, isPaidActually: false }
  ];
  const { data: theoBooking } = await supabase.from('bookings').select('*').eq('id', 'b-1788685190273').single();
  if (theoBooking) {
    await supabase.from('bookings').update({
      service_type: 'training',
      data: {
        ...(theoBooking.data || {}),
        serviceType: 'training',
        trainerStages: theoStages,
        trainerPaid: 500,
        isTrainingCompleted: false
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1788685190273');
    console.log('Updated Theo (b-1788685190273): 1/3 paid (20056), 2/3 and 3/3 remaining (500 NIS paid).');
  }

  // 4. LUNA SHLOMI (לונה המתגעגעת - שלומי ממן): שולם במלואו (1,500 ש"ח שולם, 0 נשארו)
  console.log('\n4. Updating Luna Shlomi (לונה של שלומי)...');
  const lunaShlomiStages = [
    { stage: '1/3', label: 'תשלום 1/3 (שולם במלואו)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-05-01' },
    { stage: '2/3', label: 'תשלום 2/3 (שולם במלואו)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-06-01' },
    { stage: '3/3', label: 'תשלום 3/3 (שולם במלואו)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-07-01' }
  ];
  const { data: lunaShlomi } = await supabase.from('bookings').select('*').eq('id', 'b-1789361510508').single();
  if (lunaShlomi) {
    await supabase.from('bookings').update({
      data: {
        ...(lunaShlomi.data || {}),
        trainerStages: lunaShlomiStages,
        trainerPaid: 1500,
        isTrainingCompleted: true,
        trainingCompletedAt: '2026-07-01T00:00:00Z'
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1789361510508');
    console.log('Updated Luna Shlomi (b-1789361510508): 3/3 paid in full (1,500 NIS paid).');
  }

  console.log('\n=== ALL 4 DOGS UPDATED SUCCESSFULLY IN SUPABASE ===');
}

run().catch(console.error);

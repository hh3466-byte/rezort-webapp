const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('=== CLEANING AND DEDUPLICATING TRAINING BOOKINGS IN SUPABASE ===');

  // 1. Fix Joy:
  // - b-grow-507807309 should be boarding (1 day payment record)
  await supabase.from('bookings').update({
    service_type: 'boarding',
    data: { id: 'b-grow-507807309', serviceType: 'boarding' }
  }).eq('id', 'b-grow-507807309');

  // - b-1789657778767 is the REAL 55-day training booking for Joy
  const joyStages = [
    { stage: '1/3', label: 'תשלום 1/3 (ראשון)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-08-13' },
    { stage: '2/3', label: 'תשלום 2/3 (אמצע)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-09-14', receiptNumber: '20056' },
    { stage: '3/3', label: 'תשלום 3/3 (סיום - נשאר תשלום אחרון)', amount: 500, paid: false, isPaidActually: false }
  ];
  const { data: joyReal } = await supabase.from('bookings').select('*').eq('id', 'b-1789657778767').single();
  if (joyReal) {
    await supabase.from('bookings').update({
      dog_name: "ג'וי",
      service_type: 'training',
      data: {
        ...(joyReal.data || {}),
        dogName: "ג'וי",
        serviceType: 'training',
        trainerStages: joyStages,
        trainerPaid: 1000,
        isTrainingCompleted: false
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1789657778767');
    console.log('Updated Joy real training booking (b-1789657778767)');
  }

  // 2. Fix Luna:
  // - b-1789541679348 is April 2026 boarding -> ensure service_type: 'boarding'
  await supabase.from('bookings').update({
    service_type: 'boarding',
    data: { serviceType: 'boarding' }
  }).eq('id', 'b-1789541679348');

  // - b-1789541492653 is the REAL training booking for Luna (Ronen)
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
  const { data: lunaReal } = await supabase.from('bookings').select('*').eq('id', 'b-1789541492653').single();
  if (lunaReal) {
    await supabase.from('bookings').update({
      service_type: 'training',
      data: {
        ...(lunaReal.data || {}),
        serviceType: 'training',
        trainerStages: lunaStages,
        trainerPaid: 500,
        isTrainingCompleted: false
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1789541492653');
    console.log('Updated Luna real training booking (b-1789541492653)');
  }

  // 3. Fix Theo:
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
  const { data: theoReal } = await supabase.from('bookings').select('*').eq('id', 'b-1788685190273').single();
  if (theoReal) {
    await supabase.from('bookings').update({
      service_type: 'training',
      data: {
        ...(theoReal.data || {}),
        serviceType: 'training',
        trainerStages: theoStages,
        trainerPaid: 500,
        isTrainingCompleted: false
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1788685190273');
    console.log('Updated Theo real training booking (b-1788685190273)');
  }

  // 4. Fix Boss (scheduled October):
  const bossStages = [
    { stage: '1/3', label: 'תשלום 1/3 (ראשון - כניסה באוקטובר)', amount: 500, paid: false, isPaidActually: false },
    { stage: '2/3', label: 'תשלום 2/3 (אמצע)', amount: 500, paid: false, isPaidActually: false },
    { stage: '3/3', label: 'תשלום 3/3 (סיום)', amount: 500, paid: false, isPaidActually: false }
  ];
  const { data: bossReal } = await supabase.from('bookings').select('*').eq('id', 'b-1789732108163').single();
  if (bossReal) {
    await supabase.from('bookings').update({
      service_type: 'training',
      data: {
        ...(bossReal.data || {}),
        serviceType: 'training',
        trainerStages: bossStages,
        trainerPaid: 0,
        isTrainingCompleted: false
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1789732108163');
    console.log('Updated Boss training booking (b-1789732108163)');
  }

  // 5. Fix Luna Shlomi -> Completed / Archive:
  const lunaShlomiStages = [
    { stage: '1/3', label: 'תשלום 1/3 (שולם במלואו)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-05-01' },
    { stage: '2/3', label: 'תשלום 2/3 (שולם במלואו)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-06-01' },
    { stage: '3/3', label: 'תשלום 3/3 (שולם במלואו)', amount: 500, paid: true, isPaidActually: true, paidDate: '2026-07-01' }
  ];
  const { data: lunaShlomiReal } = await supabase.from('bookings').select('*').eq('id', 'b-1789361510508').single();
  if (lunaShlomiReal) {
    await supabase.from('bookings').update({
      service_type: 'training',
      data: {
        ...(lunaShlomiReal.data || {}),
        serviceType: 'training',
        trainerStages: lunaShlomiStages,
        trainerPaid: 1500,
        isTrainingCompleted: true,
        trainingCompletedAt: '2026-07-01T00:00:00Z'
      },
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1789361510508');
    console.log('Updated Luna Shlomi as completed training (b-1789361510508)');
  }

  console.log('\n--- VERIFYING ALL TRAINING BOOKINGS ---');
  const { data: allB } = await supabase.from('bookings').select('*').eq('service_type', 'training');
  allB.forEach(b => {
    console.log(`- ${b.dog_name} (${b.owner_name}) | Dates: ${b.start_date} -> ${b.end_date} | Completed: ${b.data?.isTrainingCompleted} | Paid: ${b.data?.trainerPaid}`);
  });
}

run().catch(console.error);

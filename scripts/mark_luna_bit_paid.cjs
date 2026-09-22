const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('--- 1. Updating Settings: Marking Receipt 20057 as PAID via Bit ---');
  const { data: settingsRow, error: sErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'global')
    .single();

  if (sErr) throw sErr;

  const currentData = settingsRow.data || {};
  let trainerReceipts = currentData.trainerReceipts || [];

  const rIdx = trainerReceipts.findIndex(r => r.receiptNumber === '20057');
  const receiptObj = {
    receiptNumber: '20057',
    date: '2026-09-22',
    amount: 500,
    dogs: ['לונה'],
    notes: 'אילוף לונה 1/3 (ביט)',
    stage: '1/3',
    paid: true,
    paidDate: '2026-09-22',
    bitConfirmationNumber: '1378-7978-59402',
    bitConfirmationImageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/7e42957a-b831-4b50-863b-41c675346cda.jpg',
    imageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/428e6e1b-116f-4d95-b4bc-1aa59a83f549.jpg'
  };

  if (rIdx >= 0) {
    trainerReceipts[rIdx] = { ...trainerReceipts[rIdx], ...receiptObj };
  } else {
    trainerReceipts.push(receiptObj);
  }

  const { error: updateErr } = await supabase
    .from('settings')
    .update({
      data: {
        ...currentData,
        trainerReceipts
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', 'global');

  if (updateErr) throw updateErr;
  console.log('Settings updated successfully!');

  console.log('\n--- 2. Updating Luna Booking with Stage 1/3 Paid ---');
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .ilike('dog_name', '%לונה%');

  if (bErr) throw bErr;
  console.log(`Found ${bookings.length} bookings for Luna:`);

  for (const b of bookings) {
    console.log(`- Booking ID: ${b.id}, Dog: ${b.dog_name}, Service: ${b.service_type}`);
    const stages = [
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
      {
        stage: '2/3',
        label: 'תשלום 2/3 (אמצע)',
        amount: 500,
        paid: false,
        isPaidActually: false
      },
      {
        stage: '3/3',
        label: 'תשלום 3/3 (סוף תשלום)',
        amount: 500,
        paid: false,
        isPaidActually: false
      }
    ];

    const { error: upBookErr } = await supabase
      .from('bookings')
      .update({
        trainer_stages: stages,
        trainer_paid: 500,
        updated_at: new Date().toISOString()
      })
      .eq('id', b.id);

    if (upBookErr) {
      console.error(`Error updating booking ${b.id}:`, upBookErr);
    } else {
      console.log(`Updated Luna booking ${b.id} with stage 1 paid!`);
    }
  }

  console.log('\nDone!');
}

run().catch(console.error);

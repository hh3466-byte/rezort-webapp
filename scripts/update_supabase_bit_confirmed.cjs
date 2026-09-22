const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('--- 1. Updating settings row resort_config ---');
  const { data: sRow, error: sErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'resort_config')
    .single();

  if (sErr) throw sErr;

  const currentData = sRow.data || {};
  let trainerReceipts = currentData.trainerReceipts || [];

  const receipt20057 = {
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

  const idx = trainerReceipts.findIndex(r => r.receiptNumber === '20057');
  if (idx >= 0) {
    trainerReceipts[idx] = { ...trainerReceipts[idx], ...receipt20057 };
  } else {
    trainerReceipts.push(receipt20057);
  }

  const { error: upErr } = await supabase
    .from('settings')
    .update({
      data: {
        ...currentData,
        trainerReceipts,
        trainerBalanceStatus: 'all_paid_zero_debt',
        trainerLastSettledAt: '2026-09-22T08:58:00.000Z'
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', 'resort_config');

  if (upErr) throw upErr;
  console.log('Settings updated successfully!');

  console.log('\n--- 2. Updating Luna Booking (b-1789541492653) ---');
  const { data: lunaBooking, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', 'b-1789541492653')
    .single();

  if (bErr) throw bErr;

  const bData = lunaBooking.data || {};
  const trainerStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      isPaidActually: true,
      paid: true,
      paidDate: '2026-09-22',
      receiptNumber: '20057',
      bitConfirmationNumber: '1378-7978-59402',
      notes: 'העברת ביט ₪500 - אישור 1378-7978-59402'
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע)',
      amount: 500,
      isPaidActually: false,
      paid: false
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סוף תשלום)',
      amount: 500,
      isPaidActually: false,
      paid: false
    }
  ];

  const updatedBData = {
    ...bData,
    trainerStages,
    trainerPaid: 500
  };

  const { error: upLunaErr } = await supabase
    .from('bookings')
    .update({
      data: updatedBData,
      updated_at: new Date().toISOString()
    })
    .eq('id', 'b-1789541492653');

  if (upLunaErr) throw upLunaErr;
  console.log('Luna booking updated successfully with trainerStages and Bit confirmation!');

  console.log('\n--- 3. Verifying Final State ---');
  const { data: finalSettings } = await supabase
    .from('settings')
    .select('data')
    .eq('id', 'resort_config')
    .single();

  console.log('Receipts in DB:');
  finalSettings.data.trainerReceipts.forEach(r => {
    console.log(`- Receipt ${r.receiptNumber}: ${r.amount} NIS, dogs: ${r.dogs.join(',')}, paid: ${r.paid}, bit: ${r.bitConfirmationNumber || 'none'}`);
  });
}

run().catch(console.error);

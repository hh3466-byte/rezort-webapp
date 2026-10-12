const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('--- Registering Receipt 20064 & Bit 1007-8856-48416 ---');

  const receiptImageUrl = 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/f560f040-1d60-4f07-9b09-ae2412fbaf8b.jpg';
  const bitConfirmationImageUrl = 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/2608af4f-832e-448e-a13e-7f7470075c85.jpg';
  const bitConfirmationNumber = '1007-8856-48416';
  const receiptNumber = '20064';
  const receiptDate = '2026-10-12';
  const totalAmount = 1100;

  // 1. Update settings
  const { data: sRow, error: sErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'resort_config')
    .single();

  if (sErr) throw sErr;

  const currentData = sRow.data || {};
  let trainerReceipts = Array.isArray(currentData.trainerReceipts) ? currentData.trainerReceipts : [];

  const newReceipt = {
    id: `receipt-${receiptNumber}`,
    receiptNumber: receiptNumber,
    receiptDate: receiptDate,
    totalAmount: totalAmount,
    amount: totalAmount,
    paymentMethod: 'ביט',
    receiptImageUrl: receiptImageUrl,
    bitConfirmationImageUrl: bitConfirmationImageUrl,
    paymentConfirmationUrl: bitConfirmationImageUrl,
    bitConfirmationNumber: bitConfirmationNumber,
    rawLineText: 'תשלום 2/3 לונה לבנה, תשלום 1/3 ליאו, תשלום שעתיים עבודה בקמפיין 23.9',
    paymentConfirmationNotes: 'העברת ביט ₪1,100 להילה (אישור 1007-8856-48416) עבור לונה 2/3 (₪500), ליאו 1/3 (₪500), וקמפיין שעתיים (₪100)',
    dogs: ['לונה', 'ליאו'],
    allocations: [
      {
        bookingId: 'b-1789541492653',
        dogName: 'לונה',
        stage: '2/3',
        amount: 500
      },
      {
        bookingId: 'b-1791271522477',
        dogName: 'ליאו',
        stage: '1/3',
        amount: 500
      },
      {
        bookingId: '',
        dogName: 'קמפיין 23.9 (שעתיים)',
        stage: 'custom',
        amount: 100
      }
    ],
    isPaidActually: true,
    paid: true,
    paidDate: receiptDate,
    managerQuerySent: true,
    status: 'paid',
    createdAt: '2026-10-12T07:31:00.000Z',
    updatedAt: '2026-10-12T07:32:39.000Z'
  };

  const existingIdx = trainerReceipts.findIndex(r => r.receiptNumber === receiptNumber);
  if (existingIdx >= 0) {
    trainerReceipts[existingIdx] = { ...trainerReceipts[existingIdx], ...newReceipt };
  } else {
    trainerReceipts.unshift(newReceipt);
  }

  const { error: upErr } = await supabase
    .from('settings')
    .update({
      data: {
        ...currentData,
        trainerReceipts,
        trainerBalanceStatus: 'all_paid_zero_debt',
        trainerLastSettledAt: '2026-10-12T07:32:39.000Z'
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', 'resort_config');

  if (upErr) throw upErr;
  console.log('✓ Supabase settings updated with receipt 20064!');

  // 2. Update Luna (b-1789541492653)
  const { data: lunaBooking, error: bLunaErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', 'b-1789541492653')
    .single();

  if (bLunaErr) throw bLunaErr;

  const lunaData = lunaBooking.data || {};
  const lunaTrainerStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      isPaidActually: true,
      paid: true,
      paidDate: '2026-09-22',
      receiptDate: '2026-09-22',
      paymentMethod: 'bit',
      receiptNumber: '20057',
      bitConfirmationNumber: '1378-7978-59402',
      notes: 'שולם בביט (קבלה 20057, אישור 1378-7978-59402)'
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע)',
      amount: 500,
      isPaidActually: true,
      paid: true,
      paidDate: '2026-10-12',
      receiptDate: '2026-10-12',
      paymentMethod: 'bit',
      receiptNumber: '20064',
      bitConfirmationNumber: '1007-8856-48416',
      receiptImageUrl: receiptImageUrl,
      paymentConfirmationUrl: bitConfirmationImageUrl,
      notes: 'שולם בביט (קבלה 20064, אישור 1007-8856-48416)'
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סיום - נשאר)',
      amount: 500,
      isPaidActually: false,
      paid: false
    }
  ];

  await supabase
    .from('bookings')
    .update({
      data: {
        ...lunaData,
        trainerStages: lunaTrainerStages,
        trainerPaid: 1000,
        trainerDebt: 500
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', 'b-1789541492653');
  console.log('✓ Luna (רונן מלמוד) updated: trainerPaid=1000, trainerDebt=500, stage 2/3 closed.');

  // 3. Update Leo (b-1791271522477)
  const { data: leoBooking, error: bLeoErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', 'b-1791271522477')
    .single();

  if (bLeoErr) throw bLeoErr;

  const leoData = leoBooking.data || {};
  const leoTrainerStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      isPaidActually: true,
      paid: true,
      paidDate: '2026-10-12',
      receiptDate: '2026-10-12',
      paymentMethod: 'bit',
      receiptNumber: '20064',
      bitConfirmationNumber: '1007-8856-48416',
      receiptImageUrl: receiptImageUrl,
      paymentConfirmationUrl: bitConfirmationImageUrl,
      notes: 'שולם בביט (קבלה 20064, אישור 1007-8856-48416)'
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע - נשאר)',
      amount: 500,
      isPaidActually: false,
      paid: false
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סיום - נשאר)',
      amount: 500,
      isPaidActually: false,
      paid: false
    }
  ];

  await supabase
    .from('bookings')
    .update({
      data: {
        ...leoData,
        trainerStages: leoTrainerStages,
        trainerPaid: 500,
        trainerDebt: 1000
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', 'b-1791271522477');
  console.log('✓ Leo (לי דלויה) updated: trainerPaid=500, trainerDebt=1000, stage 1/3 closed.');

  console.log('\n--- SUCCESS: Receipt 20064 fully registered and synchronized across DB! ---');
}

run().catch(console.error);

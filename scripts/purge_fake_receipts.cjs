const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('=== PURGING FAKE RECEIPTS FROM SUPABASE SETTINGS ===');

  const { data: sRow, error: sErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'resort_config')
    .single();

  if (sErr) throw sErr;

  const currentData = sRow.data || {};

  // Keep strictly the 2 real official receipts from Hila, both 100% PAID!
  const cleanReceipts = [
    {
      id: 'receipt-20056',
      receiptNumber: '20056',
      receiptDate: '2026-09-14',
      totalAmount: 1000,
      paymentMethod: 'ביט',
      rawLineText: 'גוי תשלום 2/3 + תיאן תשלום 1/3',
      receiptImageUrl: '',
      allocations: [
        { bookingId: 'b-1789657778767', dogName: "ג'וי", stage: '2/3', amount: 500 },
        { bookingId: 'b-1788685190273', dogName: 'תיאו', stage: '1/3', amount: 500 }
      ],
      isPaidActually: true,
      paid: true,
      paidDate: '2026-09-14',
      bitConfirmationNumber: 'שולם בביט',
      paymentConfirmationNotes: 'שולם במלואו בביט להילה',
      status: 'paid'
    },
    {
      id: 'receipt-20057',
      receiptNumber: '20057',
      receiptDate: '2026-09-22',
      totalAmount: 500,
      paymentMethod: 'ביט',
      rawLineText: 'אילוף לונה (לא של שלומי) תשלום 1/3',
      receiptImageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/428e6e1b-116f-4d95-b4bc-1aa59a83f549.jpg',
      bitConfirmationImageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/7e42957a-b831-4b50-863b-41c675346cda.jpg',
      bitConfirmationNumber: '1378-7978-59402',
      allocations: [
        { bookingId: 'b-1789541492653', dogName: 'לונה', stage: '1/3', amount: 500 }
      ],
      isPaidActually: true,
      paid: true,
      paidDate: '2026-09-22',
      paymentConfirmationNotes: 'העברת ביט ₪500 - אישור 1378-7978-59402',
      status: 'paid'
    }
  ];

  const { error: upErr } = await supabase
    .from('settings')
    .update({
      data: {
        ...currentData,
        trainerReceipts: cleanReceipts,
        trainerBalanceStatus: 'all_paid_zero_debt',
        trainerLastSettledAt: '2026-09-22T08:58:00.000Z'
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', 'resort_config');

  if (upErr) throw upErr;
  console.log('Successfully saved 2 clean paid receipts in Supabase!');
}

run().catch(console.error);

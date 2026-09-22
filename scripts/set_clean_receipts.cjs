const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: sRow, error: sErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'resort_config')
    .single();

  if (sErr) throw sErr;

  const currentData = sRow.data || {};

  const trainerReceipts = [
    {
      receiptNumber: '20056',
      date: '2026-09-22',
      amount: 1000,
      dogs: ['ג\'וי', 'תיאו'],
      stage: 'ג\'וי 2/3 + תיאו 1/3',
      notes: 'שולם במלואו (סילוק חובות היסטורי)',
      paid: true,
      paidDate: '2026-09-22',
      bitConfirmationNumber: 'שולם במלואו בביט'
    },
    {
      receiptNumber: '20057',
      date: '2026-09-22',
      amount: 500,
      dogs: ['לונה'],
      stage: '1/3',
      notes: 'אילוף לונה 1/3 (ביט)',
      paid: true,
      paidDate: '2026-09-22',
      bitConfirmationNumber: '1378-7978-59402',
      bitConfirmationImageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/7e42957a-b831-4b50-863b-41c675346cda.jpg',
      imageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/428e6e1b-116f-4d95-b4bc-1aa59a83f549.jpg'
    }
  ];

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
  console.log('Successfully set trainer receipts in Supabase:');
  trainerReceipts.forEach(r => {
    console.log(`- Receipt ${r.receiptNumber}: ${r.amount} ₪ | Dogs: ${r.dogs.join(', ')} | Paid: ${r.paid} | Bit: ${r.bitConfirmationNumber}`);
  });
}

run().catch(console.error);

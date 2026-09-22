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
  let trainerReceipts = currentData.trainerReceipts || [];

  // Normalize all receipts
  trainerReceipts = trainerReceipts.map(r => ({
    receiptNumber: String(r.receiptNumber || ''),
    date: r.date || '2026-09-22',
    amount: Number(r.amount || 0),
    dogs: Array.isArray(r.dogs) ? r.dogs : (typeof r.dogs === 'string' ? [r.dogs] : []),
    stage: r.stage || '',
    notes: r.notes || '',
    paid: Boolean(r.paid),
    paidDate: r.paidDate || (r.paid ? '2026-09-22' : undefined),
    bitConfirmationNumber: r.bitConfirmationNumber || undefined,
    bitConfirmationImageUrl: r.bitConfirmationImageUrl || undefined,
    imageUrl: r.imageUrl || undefined
  }));

  const { error: upErr } = await supabase
    .from('settings')
    .update({
      data: {
        ...currentData,
        trainerReceipts,
        trainerBalanceStatus: 'all_paid_zero_debt'
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', 'resort_config');

  if (upErr) throw upErr;
  console.log('Cleaned and normalized all receipts in DB:');
  trainerReceipts.forEach(r => {
    console.log(`- Receipt ${r.receiptNumber}: ${r.amount} ₪ | Dogs: ${r.dogs.join(', ')} | Paid: ${r.paid} | Bit: ${r.bitConfirmationNumber || 'None'}`);
  });
}

run().catch(console.error);

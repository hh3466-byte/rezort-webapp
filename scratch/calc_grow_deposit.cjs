const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkGrow() {
  const { data: grow, error: growErr } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false });
  if (growErr) {
    console.error('Grow error:', growErr);
    return;
  }
  console.log(`Total grow payments count: ${grow?.length}`);
  let sumOct = 0;
  let octPayments = [];
  grow?.forEach(p => {
    const d = p.payment_date || p.created_at || '';
    if (d.includes('2026-10')) {
      sumOct += Number(p.amount || 0);
      octPayments.push(p);
    }
  });

  console.log(`--- OCTOBER 2026 GROW PAYMENTS (Deposit on 10.11.2026) ---`);
  console.log(`Count: ${octPayments.length}`);
  console.log(`Total Amount: ₪${sumOct.toLocaleString()}`);
  octPayments.forEach(p => {
    console.log(`Date: ${p.payment_date || p.created_at} | Amount: ₪${p.amount} | Payer: ${p.customer_name} | Dog: ${p.dog_name} | Type: ${p.payment_method || 'grow'} | TransId: ${p.transaction_id || p.id}`);
  });

  // Also check September 2026 (deposited on 10.10.2026)
  let sumSep = 0;
  grow?.forEach(p => {
    const d = p.payment_date || p.created_at || '';
    if (d.includes('2026-09')) {
      sumSep += Number(p.amount || 0);
    }
  });
  console.log(`\n--- SEPTEMBER 2026 (Deposited on 10.10.2026): ₪${sumSep.toLocaleString()} ---`);
}
checkGrow();

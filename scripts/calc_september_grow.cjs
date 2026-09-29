const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
  const { data: bookings } = await supabase.from('bookings').select('*');

  console.log('=== All Grow Payments in DB (September) ===');
  let sepTotal = 0;
  let sepGrowOnly = 0;

  growPayments
    .filter(p => (p.created_at || '').startsWith('2026-09'))
    .forEach(p => {
      const isRonen = (p.customer_name || '').includes('רונן') || (p.reference_id || '').includes('ronen');
      const isDismissed = p.status === 'dismissed';
      const isRefunded = p.status === 'refunded';
      console.log(`[${p.created_at?.slice(0, 10)}] ${p.customer_name} | ₪${p.amount} | Ref: ${p.reference_id} | Status: ${p.status} | Method: ${p.payment_method}`);
      if (!isDismissed && !isRefunded && !isRonen) {
        sepGrowOnly += Number(p.amount) || 0;
      }
    });

  console.log(`\n>>> Total Pure GROW to enter bank on 10.10: ₪${sepGrowOnly}`);
}

run();

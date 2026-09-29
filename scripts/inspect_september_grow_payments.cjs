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
  const { data: growPayments, error } = await supabase
    .from('grow_incoming_payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching grow_incoming_payments:', error);
    return;
  }

  console.log(`=== Total Grow Incoming Payments: ${growPayments.length} ===`);
  
  // Let's filter by September 2026
  const sepPayments = growPayments.filter(p => {
    // Check created_at or snippet date
    const d = p.created_at || '';
    return d.startsWith('2026-09');
  });

  console.log(`\n=== September 2026 Grow Payments in Table: ${sepPayments.length} ===`);
  let totalSep = 0;
  sepPayments.forEach(p => {
    console.log(`- Date: ${p.created_at?.slice(0, 10)} | Ref: ${p.reference_id} | Amount: ₪${p.amount} | Name: ${p.customer_name} | Status: ${p.status} | Method: ${p.payment_method}`);
    totalSep += Number(p.amount) || 0;
  });
  console.log(`Total September Grow Amount in Table: ₪${totalSep}`);

  // Let's check all payments in table regardless of date
  console.log('\n=== All payments in grow_incoming_payments: ===');
  growPayments.forEach(p => {
    console.log(`- Date: ${p.created_at?.slice(0, 10)} | Ref: ${p.reference_id} | Amount: ₪${p.amount} | Name: ${p.customer_name} | Status: ${p.status}`);
  });

  // Let's also check bookings payments / deposits
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log(`\n=== Total Bookings in DB: ${bookings?.length} ===`);
  
  // Let's check bookings modified or created recently or with payments
  const recentPaidBookings = (bookings || []).filter(b => {
    const d = b.data || {};
    const dep = Number(b.depositAmount || d.depositAmount || 0);
    const tot = Number(b.totalPrice || d.totalPrice || 0);
    const pStat = b.paymentStatus || d.paymentStatus;
    return pStat === 'fully_paid' || pStat === 'deposit_paid' || dep > 0 || tot > 0;
  });
  console.log(`Bookings with payments: ${recentPaidBookings.length}`);

}

run();

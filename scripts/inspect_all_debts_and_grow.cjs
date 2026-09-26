const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('=== 1. Detailed grow_incoming_payments for 2000 / 4500 ===');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
  const sepPayments = (growPayments || []).filter(p => p.amount === 4500 || p.amount === 2000 || p.amount === 6500 || JSON.stringify(p).includes('4900844785'));
  sepPayments.forEach(p => console.log(JSON.stringify(p, null, 2)));

  console.log('\n=== 2. ALL ALL ALL Grow incoming payments ===');
  (growPayments || []).forEach(p => {
    console.log(`[${p.id || p.grow_payment_id}] Date: ${p.transaction_date || p.created_at} | Amount: ₪${p.amount} | Payer: ${p.payer_name} | Phone: ${p.payer_phone} | Ref: ${p.transaction_id || p.reference || p.grow_payment_id} | Status: ${p.status} | BookingId: ${p.booking_id}`);
  });

  console.log('\n=== 3. ALL OPEN DEBTS IN BOOKINGS (stay_status != cancelled) ===');
  const { data: bookings } = await supabase.from('bookings').select('*').neq('stay_status', 'cancelled');
  
  const openDebts = [];
  bookings.forEach(b => {
    const total = Number(b.total_price || b.totalPrice) || 0;
    const dep = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay;
    const debt = isFree ? 0 : Math.max(0, total - dep);
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const sType = b.service_type || b.serviceType || '';
    const payStatus = b.payment_status || b.paymentStatus;
    const payMethod = b.payment_method || b.paymentMethod;
    const notes = b.notes || '';

    if (debt > 0 || (total > 0 && dep === 0) || payStatus !== 'fully_paid') {
      openDebts.push({
        id: b.id,
        dog,
        owner,
        phone,
        start,
        end,
        sType,
        total,
        dep,
        debt,
        payStatus,
        payMethod,
        notes
      });
    }
  });

  console.log(`\nFound ${openDebts.length} bookings with open balance / not marked fully paid:`);
  openDebts.forEach((d, idx) => {
    console.log(`\n#${idx + 1} 🐕 ${d.dog} (${d.owner}) | 📞 ${d.phone}`);
    console.log(`   תאריכים: ${d.start} עד ${d.end} | סוג: ${d.sType}`);
    console.log(`   סה"כ: ₪${d.total} | שולם כמקדמה/חלקי: ₪${d.dep} | יתרת חוב רשומה: ₪${d.debt}`);
    console.log(`   סטטוס תשלום: ${d.payStatus} | אמצעי: ${d.payMethod}`);
    console.log(`   הערות: ${d.notes}`);
  });
}

run();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAll() {
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  const { data: payments, error: pErr } = await supabase.from('grow_incoming_payments').select('*');

  if (bErr || pErr) {
    console.error('Error:', bErr || pErr);
    return;
  }

  console.log(`Total bookings: ${bookings.length}, Total Grow payments: ${payments.length}`);

  const discrepancies = [];

  bookings.forEach(b => {
    const phone = (b.owner_phone || b.data?.ownerPhone || '').replace(/\D/g, '').slice(-9);
    const name = (b.owner_name || b.data?.ownerName || '').trim().toLowerCase();
    const dName = (b.dog_name || b.data?.dogName || '');
    
    // Find all Grow payments for this person
    const matched = payments.filter(p => {
      const pPhone = (p.customer_phone || '').replace(/\D/g, '').slice(-9);
      const pName = (p.customer_name || '').trim().toLowerCase();
      return (phone && pPhone && phone === pPhone) || (name && pName && (name.includes(pName) || pName.includes(name)));
    });

    const totalGrow = matched.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const deposit = Number(b.deposit_amount ?? b.data?.depositAmount ?? 0);
    const total = Number(b.total_price ?? b.data?.totalPrice ?? 0);
    const status = b.payment_status || b.data?.paymentStatus;

    if (totalGrow > 0 && Math.abs(totalGrow - deposit) > 1) {
      discrepancies.push({
        id: b.id,
        dogName: dName,
        ownerName: b.owner_name,
        bookingDeposit: deposit,
        bookingTotalPrice: total,
        growTotalPaid: totalGrow,
        paymentStatus: status,
        growCount: matched.length
      });
    }
  });

  console.log(`Found ${discrepancies.length} discrepancies:`);
  console.log(JSON.stringify(discrepancies, null, 2));
}

checkAll();

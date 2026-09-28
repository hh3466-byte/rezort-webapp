const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function deepAudit() {
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  const { data: growPayments, error: pErr } = await supabase.from('grow_incoming_payments').select('*');

  if (bErr || pErr) {
    console.error('Error fetching data:', bErr || pErr);
    return;
  }

  console.log(`=== FULL FINANCIAL DATABASE AUDIT (${bookings.length} Bookings, ${growPayments.length} Grow Payments) ===\n`);

  const summary = {
    fullyPaid: 0,
    depositPaid: 0,
    unpaid: 0,
    freeStays: 0,
    anomalies: []
  };

  for (const b of bookings) {
    const total = Number(b.total_price ?? b.data?.totalPrice ?? 0);
    const deposit = Number(b.deposit_amount ?? b.data?.depositAmount ?? 0);
    const status = b.payment_status || b.data?.paymentStatus || 'unpaid';
    const isFree = Boolean(b.is_free_stay || b.data?.isFreeStay);
    const phone = (b.owner_phone || b.data?.ownerPhone || '').replace(/\D/g, '').slice(-9);
    const name = (b.owner_name || b.data?.ownerName || '').trim().toLowerCase();
    const dName = (b.dog_name || b.data?.dogName || '');
    const notes = b.notes || b.data?.notes || '';

    // Find Grow payments
    const matchedGrow = growPayments.filter(p => {
      const pPhone = (p.customer_phone || '').replace(/\D/g, '').slice(-9);
      const pName = (p.customer_name || '').trim().toLowerCase();
      return (phone && pPhone && phone === pPhone) || (name && pName && (name.includes(pName) || pName.includes(name)));
    });
    const totalGrow = matchedGrow.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const debt = Math.max(0, total - deposit);

    if (isFree) {
      summary.freeStays++;
    } else if (status === 'fully_paid' || debt === 0) {
      summary.fullyPaid++;
    } else if (deposit > 0) {
      summary.depositPaid++;
      // Check if this depositPaid booking has an anomaly (e.g. totalGrow > deposit or total was theoretical)
      console.log(`[DEPOSIT PAID / DEBT] ${dName} (${b.owner_name}): Total=₪${total}, Deposit=₪${deposit}, Debt=₪${debt} | Grow Paid=₪${totalGrow} (txs: ${matchedGrow.length})`);
      if (notes) console.log(`   Notes: ${notes.slice(0, 120)}`);
      
      if (totalGrow > 0 && Math.abs(totalGrow - deposit) > 1) {
        summary.anomalies.push({
          id: b.id,
          dogName: dName,
          ownerName: b.owner_name,
          type: 'grow_deposit_mismatch',
          bookingDeposit: deposit,
          growTotal: totalGrow,
          totalPrice: total
        });
      }
    } else {
      summary.unpaid++;
      if (totalGrow > 0) {
        console.log(`[UNPAID BUT GROW EXISTS] ${dName} (${b.owner_name}): in booking ₪0, but Grow has ₪${totalGrow}!`);
        summary.anomalies.push({
          id: b.id,
          dogName: dName,
          ownerName: b.owner_name,
          type: 'unpaid_with_grow_payment',
          bookingDeposit: deposit,
          growTotal: totalGrow,
          totalPrice: total
        });
      }
    }
  }

  console.log('\n=== AUDIT SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
}

deepAudit();

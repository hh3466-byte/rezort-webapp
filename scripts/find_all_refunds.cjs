const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim();
  });
} catch(e) {}

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function searchRefunds() {
  console.log('=== 1. Check all bookings for refund fields or notes ===');
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  if (bookings) {
    console.log(`Total bookings in DB: ${bookings.length}`);
    bookings.forEach(b => {
      const d = b.data || {};
      const str = JSON.stringify(b);
      const refundAmt = Number(b.refundAmount ?? d.refundAmount ?? 0);
      const hasRefund = refundAmt > 0;
      const mentionsRefund = str.includes('החזר') || str.includes('זיכוי') || str.includes('refund') || str.includes('בוטל') || str.includes('cancelled');
      if (hasRefund || mentionsRefund) {
        console.log(`Booking ID: ${b.id} | Dog: "${b.dogName || d.dogName}" | Owner: "${b.ownerName || d.ownerName}" (${b.ownerPhone || d.ownerPhone}) | StayStatus: ${b.stayStatus || d.stayStatus} | RefundAmt: ${refundAmt} | RefundReason: "${b.refundReason || d.refundReason || ''}" | Notes: "${b.notes || d.notes || ''}"`);
      }
    });
  } else {
    console.log('Bookings err:', bErr);
  }

  console.log('\n=== 2. Check grow_incoming_payments for negative amounts or refunds ===');
  const { data: grows, error: gErr } = await supabase.from('grow_incoming_payments').select('*');
  if (grows) {
    console.log(`Total grow payments in DB: ${grows.length}`);
    grows.forEach(g => {
      const amt = Number(g.amount || 0);
      const str = JSON.stringify(g);
      if (amt < 0 || str.includes('החזר') || str.includes('זיכוי') || str.includes('refund') || str.includes('ביטול')) {
        console.log(`Grow ID: ${g.id} | Amount: ${g.amount} | Payer: ${g.payer_name || g.payerName} | Ref: ${g.transaction_id || g.transactionId} | Notes: ${g.notes || ''}`);
      }
    });
  } else {
    console.log('Grows err:', gErr);
  }

  console.log('\n=== 3. Check git log for any commits about refund/זיכוי/ג\'נגו/שון/רומי/וכו\' ===');
}

searchRefunds();

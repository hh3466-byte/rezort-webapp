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

function cleanPhone(p) {
  if (!p) return '';
  return String(p).replace(/\D/g, '');
}

async function run() {
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  const { data: growPayments, error: gErr } = await supabase.from('grow_incoming_payments').select('*');

  if (bErr || gErr) {
    console.error('Error fetching data:', bErr || gErr);
    return;
  }

  console.log(`Loaded ${bookings.length} bookings and ${growPayments.length} Grow payments.\n`);

  // Index grow payments by phone (last 7 digits) and email
  const growByPhone = new Map();
  growPayments.forEach(g => {
    const p = cleanPhone(g.payer_phone || g.phone);
    if (p) {
      const p7 = p.slice(-7);
      if (!growByPhone.has(p7)) growByPhone.set(p7, []);
      growByPhone.get(p7).push(g);
    }
  });

  let totalCashExplicit = 0;
  let totalNonGrowDifference = 0;
  const cashBookings = [];
  const differenceBookings = [];

  bookings.forEach(b => {
    const d = b.data || {};
    const dog = b.dog_name || d.dogName;
    const owner = b.owner_name || d.ownerName;
    const phone = b.owner_phone || d.ownerPhone;
    const p7 = cleanPhone(phone).slice(-7);
    const totalPrice = Number(b.total_price ?? d.totalPrice ?? 0);
    const depositAmount = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const paymentStatus = b.payment_status || d.paymentStatus;
    const paymentMethod = b.payment_method || d.paymentMethod;
    const stayStatus = b.stay_status || d.stayStatus;
    const notes = (b.notes || d.notes || '') + ' ' + (d.internalNotes || '');

    if (stayStatus === 'cancelled') return;

    // Find all grow payments for this owner
    const matchedGrow = p7 ? (growByPhone.get(p7) || []) : [];
    const growSum = matchedGrow.reduce((sum, g) => sum + Number(g.amount || 0), 0);

    const isExplicitCash = paymentMethod === 'cash' || notes.includes('מזומן');
    
    // Total actually recorded as received for this booking
    const amountCollected = paymentStatus === 'fully_paid' ? totalPrice : depositAmount;

    // Is there an amount collected beyond Grow payments, or is it closed without Grow?
    const nonGrowDiff = Math.max(0, amountCollected - growSum);

    if (isExplicitCash) {
      totalCashExplicit += amountCollected;
      cashBookings.push({
        id: b.id,
        dog,
        owner,
        phone,
        totalPrice,
        amountCollected,
        paymentStatus,
        paymentMethod,
        growSum,
        notes: notes.trim()
      });
    }

    if (amountCollected > 0 && (growSum === 0 || nonGrowDiff > 0)) {
      totalNonGrowDifference += (growSum === 0 ? amountCollected : nonGrowDiff);
      differenceBookings.push({
        id: b.id,
        dog,
        owner,
        phone,
        totalPrice,
        amountCollected,
        growSum,
        nonGrowDiff: growSum === 0 ? amountCollected : nonGrowDiff,
        paymentMethod,
        paymentStatus,
        stayStatus,
        notes: notes.trim()
      });
    }
  });

  console.log('================================================================');
  console.log('1. EXPLICIT CASH BOOKINGS (paymentMethod="cash" or note has "מזומן"):');
  console.log('================================================================');
  console.log(`Total count: ${cashBookings.length}, Total amount: ₪${totalCashExplicit.toLocaleString()}`);
  cashBookings.forEach(c => {
    console.log(`- [${c.id}] ${c.dog} (${c.owner}, ${c.phone}): Collected ₪${c.amountCollected} (Total: ₪${c.totalPrice}) | Status: ${c.paymentStatus} | Method: ${c.paymentMethod} | Notes: "${c.notes}"`);
  });

  console.log('\n================================================================');
  console.log('2. ALL BOOKINGS CLOSED / COLLECTED WITHOUT GROW PAYMENTS (The difference):');
  console.log('================================================================');
  console.log(`Total count: ${differenceBookings.length}, Total non-Grow collected: ₪${totalNonGrowDifference.toLocaleString()}`);
  differenceBookings.forEach(c => {
    console.log(`- [${c.id}] ${c.dog} (${c.owner}, ${c.phone}): Collected: ₪${c.amountCollected} | Grow matched: ₪${c.growSum} | Difference (Cash/Direct): ₪${c.nonGrowDiff} | Method: ${c.paymentMethod} | PayStatus: ${c.paymentStatus} | StayStatus: ${c.stayStatus} | Notes: "${c.notes}"`);
  });
}

run();

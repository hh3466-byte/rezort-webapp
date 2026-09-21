const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^['\"]|['\"]$/g, '');
});
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: bookings } = await sb.from('bookings').select('*');
  const { data: growPayments } = await sb.from('grow_incoming_payments').select('*');

  console.log('================================================================');
  console.log('   FORENSIC ANALYSIS: REAL SEPTEMBER 2026 GROW VS ACTUAL CASH   ');
  console.log('================================================================\n');

  // 1. ALL GROW TRANSACTIONS IN SEPTEMBER 2026 (FROM EMAIL SYNC / GROW TABLE)
  const sepGrow = [];
  let totalSepGrow = 0;

  growPayments.forEach(g => {
    const d = (g.created_at || '').substring(0, 7);
    if (d === '2026-09') {
      const amt = Number(g.amount) || 0;
      totalSepGrow += amt;
      sepGrow.push({
        ref: g.reference_id,
        name: g.customer_name,
        amt,
        date: g.created_at?.substring(0, 10),
        method: g.payment_method
      });
    }
  });

  console.log(`--- 1. ALL VERIFIED GROW PAYMENTS IN SEPTEMBER (ENTERING BANK ON 10.10) ---`);
  console.log(`Count: ${sepGrow.length} transactions | Total: ₪${totalSepGrow.toLocaleString()}`);
  sepGrow.forEach(g => {
    console.log(`• אסמכתא: ${g.ref} | ${g.date} | ${g.name} | ₪${g.amt.toLocaleString()} | ${g.method}`);
  });

  // 2. NOW LET'S LOOK AT ALL SEPTEMBER BOOKINGS
  console.log(`\n--- 2. REAL CASH OR NON-GROW TRANSACTIONS ---`);
  const realCash = [];
  const bankTransfers = [];
  const futureBookings = [];

  bookings.forEach(b => {
    const d = b.data || {};
    const dog = b.dog_name || d.dogName || '';
    const owner = b.owner_name || d.ownerName || '';
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).trim();
    const start = b.start_date || d.startDate || '';
    const end = b.end_date || d.endDate || '';
    const created = b.created_at || d.createdAt || '';
    const total = Number(b.total_price ?? d.totalPrice ?? 0);
    const dep = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const payStatus = b.payment_status || d.paymentStatus;
    const stayStatus = b.stay_status || d.stayStatus;

    if (stayStatus === 'cancelled' || payStatus === 'unpaid' || total <= 0) return;

    // Is it Joy (Aug)?
    if (dog.includes("ג'וי") || dog.includes("גו'י")) return;

    // Check if matched to ANY Grow payment in the table
    const matchedGrow = growPayments.find(g => {
      const ref = String(g.reference_id || g.id);
      return notes.includes(ref) || b.id.includes(ref);
    });

    if (matchedGrow) {
      // This is a GROW transaction!
      return;
    }

    // Check if it's Ronen Malamud (Bank transfer for Miluim reserve duty)
    if (owner.includes('רונן') || owner.includes('מלמוד')) {
      bankTransfers.push({
        dog,
        owner,
        total,
        dates: `${start}..${end}`,
        note: 'העברה בנקאית עבור קבלות מילואים (לא מזומן לשמוליק!)'
      });
      return;
    }

    // Is it a future booking (not September)?
    if (start > '2026-09-30' && created < '2026-09-01') return;
    if (start.startsWith('2026-11')) {
      futureBookings.push({ dog, owner, amt: dep || total, dates: `${start}..${end}` });
      return;
    }

    // Only active in September
    const isSep = start.startsWith('2026-09') || end.startsWith('2026-09') || created.startsWith('2026-09');
    if (!isSep) return;

    const amt = payStatus === 'fully_paid' ? total : dep;
    realCash.push({
      id: b.id,
      dog,
      owner,
      amt,
      dates: `${start}..${end}`,
      method: b.payment_method || d.paymentMethod,
      notes
    });
  });

  const realCashSum = realCash.reduce((acc, c) => acc + c.amt, 0);
  console.log(`Real Cash / Direct Sum: ₪${realCashSum.toLocaleString()} (${realCash.length} bookings)`);
  realCash.forEach(c => {
    console.log(`- ${c.dog} (${c.owner}): ₪${c.amt.toLocaleString()} | תאריכים: ${c.dates} | שיטה: ${c.method || 'מזומן/ביט ישיר'}`);
  });

  console.log(`\n--- 3. NON-CASH ITEMS PREVIOUSLY CONFUSED AS "CASH" ---`);
  console.log(`• רונן מלמוד: ₪${bankTransfers.reduce((a, b) => a + b.total, 0).toLocaleString()} (העברה ישירה לחשבון לקבלת החזר מילואים)`);
  console.log(`• מרינה (Rem): ₪${futureBookings.reduce((a, b) => a + b.amt, 0).toLocaleString()} (מקדמה לחודש נובמבר)`);
  console.log(`• רעות פויר (טר): ₪1,350 (נסלק בכרטיס אשראי Grow אסמכתא 517823870!)`);
  console.log(`• תם דנינו (מימי רוז): ₪540 (נסלק בכרטיס אשראי Grow אסמכתא 517029357!)`);
  console.log(`• יונתן וולפין (זיפו): ₪720 (נסלק בכרטיס אשראי Grow אסמכתא 517441750!)`);
  console.log(`• יניב אלעד (ג'נגו): ₪990 (נסלק בכרטיס אשראי Grow אסמכתא 516703080!)`);
}

main();

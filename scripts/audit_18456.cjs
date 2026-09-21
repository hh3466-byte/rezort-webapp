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
  const targetMonth = '2026-09';

  const GROW_SEP_REFS = ['4857277218', '173783725', '173758692', '514721903', '515223561', '174291549', '516299998'];

  console.log('=== AUDITING THE 18,456 CASH / DIRECT PAYMENTS ===\n');

  const items = [];

  bookings.forEach(b => {
    const d = b.data || {};
    const dogName = b.dog_name || d.dogName || '';
    const ownerName = b.owner_name || d.ownerName || '';
    const ownerPhone = b.owner_phone || d.ownerPhone || '';
    const payStatus = b.payment_status || d.paymentStatus;
    const payMethod = b.payment_method || d.paymentMethod;
    const stayStatus = b.stay_status || d.stayStatus;
    const totalPrice = Number(b.total_price ?? d.totalPrice ?? 0);
    const depAmount = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).trim();
    const start = b.start_date || d.startDate || '';
    const end = b.end_date || d.endDate || '';
    const created = b.created_at || d.createdAt || '';

    if (stayStatus === 'cancelled' || payStatus === 'unpaid' || totalPrice <= 0) return;

    // Joy
    if (dogName.includes("ג'וי") || dogName.includes("גו'י")) return;

    // Is it in Sep Grow?
    const isGrow = GROW_SEP_REFS.some(ref => notes.includes(ref) || b.id.includes(ref));
    if (isGrow) return;

    // Is relevant to September?
    const isSep = start.startsWith(targetMonth) || end.startsWith(targetMonth) || created.startsWith(targetMonth);
    if (!isSep) return;

    const amt = payStatus === 'fully_paid' ? totalPrice : depAmount;
    if (amt <= 0) return;

    items.push({
      id: b.id,
      dog: dogName,
      owner: ownerName,
      phone: ownerPhone,
      amt,
      totalPrice,
      depAmount,
      payStatus,
      payMethod,
      stayStatus,
      start,
      end,
      created,
      notes
    });
  });

  let total = 0;
  items.forEach((item, idx) => {
    total += item.amt;
    console.log(`${idx + 1}. כלב: ${item.dog} | בעלים: ${item.owner} (${item.phone})`);
    console.log(`   סכום שנחשב כמזומן: ₪${item.amt.toLocaleString()} (מתוך סה"כ ₪${item.totalPrice.toLocaleString()})`);
    console.log(`   אמצעי תשלום רשום: "${item.payMethod}" | סטטוס: "${item.payStatus}" | שהייה: ${item.start} עד ${item.end}`);
    console.log(`   תאריך יצירה: ${item.created}`);
    console.log(`   הערות: ${item.notes || 'אין הערות'}`);
    console.log('---------------------------------------------------------');
  });

  console.log(`\nסה"כ: ₪${total.toLocaleString()}`);
}

main();

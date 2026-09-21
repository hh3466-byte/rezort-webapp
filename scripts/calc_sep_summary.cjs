const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^['\"]|['\"]$/g, '');
});
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const GROW_SEP_REFS = ['4857277218', '173783725', '173758692', '514721903', '515223561', '174291549', '516299998'];
// Amounts: 180, 180, 180, 6300, 360, 540, 675 = 8415

async function main() {
  const { data: bookings } = await sb.from('bookings').select('*');
  const targetMonth = '2026-09';

  let growTotal = 8415; // exactly 7 confirmed transactions
  let cashTotal = 0;
  let otherTotal = 0;

  const cashItems = [];

  bookings.forEach(b => {
    const d = b.data || {};
    const notes = (b.notes || d.notes || '') + ' ' + (d.internalNotes || '');
    const payMethod = b.payment_method || d.paymentMethod;
    const payStatus = b.payment_status || d.paymentStatus;
    const stayStatus = b.stay_status || d.stayStatus;
    const total = Number(b.total_price ?? d.totalPrice ?? 0);
    const dep = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const collected = payStatus === 'fully_paid' ? total : dep;

    if (stayStatus === 'cancelled' || collected <= 0) return;

    // Check if active in Sep or created in Sep
    const start = b.start_date || d.startDate || '';
    const end = b.end_date || d.endDate || '';
    const created = b.created_at || d.createdAt || '';
    const isSep = start.startsWith(targetMonth) || end.startsWith(targetMonth) || created.startsWith(targetMonth);
    if (!isSep) return;

    // If it's Joy (Aug Grow), skip
    if (b.dog_name === "ג'וי" || d.dogName === "ג'וי") return;

    // Check if it's one of the Sep Grow bookings
    const isGrow = GROW_SEP_REFS.some(ref => notes.includes(ref) || b.id.includes(ref));
    if (isGrow) {
      // In Sep Grow, we already count the exact 8415
      // If Dorin has 2700 - 675 = 2025 difference
      if (b.dog_name === 'מגן' || d.dogName === 'מגן') {
        const diff = total - 675;
        if (diff > 0) {
          cashTotal += diff;
          cashItems.push({ dog: 'מגן (הפרש שלא נסלק ב-Grow)', owner: 'דורין לוקס', amt: diff });
        }
      }
      return;
    }

    // Otherwise, this was collected in Sep WITHOUT Grow (Cash, Bit direct, Bank transfer)
    cashTotal += collected;
    cashItems.push({ dog: b.dog_name || d.dogName, owner: b.owner_name || d.ownerName, amt: collected, method: payMethod, notes });
  });

  console.log('=== SEPTEMBER REVENUE BREAKDOWN ===');
  console.log('GROW (יכנס ב-10.10): ₪' + growTotal.toLocaleString());
  console.log('נסלק במזומן / ישיר: ₪' + cashTotal.toLocaleString());
  console.log('סה"כ (Grow + מזומן): ₪' + (growTotal + cashTotal).toLocaleString());
  console.log('\nפירוט המזומן / ישיר:');
  cashItems.forEach(i => console.log(`- ${i.dog} (${i.owner}): ₪${i.amt.toLocaleString()} [${i.method || 'מזומן'}]`));
}
main();

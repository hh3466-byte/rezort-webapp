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
  const { data: growTable } = await sb.from('grow_incoming_payments').select('*');

  console.log('=== CHECKING RECENT GROW TABLE PAYMENTS ===');
  growTable?.forEach(g => {
    console.log(`Grow Row: ref=${g.reference_id}, name=${g.customer_name}, amt=${g.amount}, phone=${g.customer_phone}, date=${g.created_at}, method=${g.payment_method}`);
  });

  console.log('\n=== CHECKING NOTES OF ALL SEPTEMBER BOOKINGS FOR GROW ASMACHTAOT ===');
  bookings.forEach(b => {
    const d = b.data || {};
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).trim();
    const dog = b.dog_name || d.dogName;
    const owner = b.owner_name || d.ownerName;
    const total = b.total_price ?? d.totalPrice;
    const dep = b.deposit_amount ?? d.depositAmount;

    // Search for any reference number in notes
    const match = notes.match(/אסמכתא:?\s*([a-zA-Z0-9_-]+)/) || notes.match(/Grow\s*\(([^)]+)\)/);
    if (match) {
      console.log(`[${dog} - ${owner}] Total: ₪${total}, Dep: ₪${dep} | Reference: ${match[0]} | Dates: ${b.start_date}..${b.end_date}`);
    }
  });
}
main();

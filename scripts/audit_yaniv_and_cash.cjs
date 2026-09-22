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
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  console.log('=== 1. YANIV ELAD BOOKINGS ===');
  const yaniv = bookings.filter(b => (b.owner_name || b.data?.ownerName || '').includes('יניב') || (b.owner_name || b.data?.ownerName || '').includes('אלעד'));
  yaniv.forEach(b => {
    console.log({
      id: b.id,
      dog: b.dog_name || b.data?.dogName,
      owner: b.owner_name || b.data?.ownerName,
      phone: b.owner_phone || b.data?.ownerPhone,
      start: b.start_date || b.data?.startDate,
      end: b.end_date || b.data?.endDate,
      total: b.total_price ?? b.data?.totalPrice,
      deposit: b.deposit_amount ?? b.data?.depositAmount,
      refund: b.refund_amount ?? b.data?.refundAmount,
      refundDate: b.refund_date || b.data?.refundDate,
      pStatus: b.payment_status || b.data?.paymentStatus,
      sStatus: b.stay_status || b.data?.stayStatus,
      pMethod: b.payment_method || b.data?.paymentMethod,
      notes: b.notes || b.data?.notes,
      internalNotes: b.data?.internalNotes
    });
  });

  console.log('\n=== 2. ALL ACTIVE SEPTEMBER BOOKINGS ===');
  const sepBookings = bookings.filter(b => {
    const s = b.start_date || b.data?.startDate || '';
    const e = b.end_date || b.data?.endDate || '';
    return (s.startsWith('2026-09') || e.startsWith('2026-09')) && b.stay_status !== 'cancelled';
  });

  sepBookings.forEach(b => {
    const d = b.data || {};
    const dog = b.dog_name || d.dogName;
    const owner = b.owner_name || d.ownerName;
    const phone = b.owner_phone || d.ownerPhone;
    const total = b.total_price ?? d.totalPrice;
    const dep = b.deposit_amount ?? d.depositAmount;
    const ref = b.refund_amount ?? d.refundAmount;
    const method = b.payment_method || d.paymentMethod;
    const pStatus = b.payment_status || d.paymentStatus;
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).trim();

    console.log(`• [${b.id}] ${dog} (${owner}, ${phone}) | סה"כ: ₪${total}, שולם: ₪${dep}, החזר: ₪${ref} | שיטה: ${method} (${pStatus}) | הערות: ${notes}`);
  });
}

run();

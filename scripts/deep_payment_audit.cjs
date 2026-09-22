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

async function runAudit() {
  console.log('=====================================================');
  console.log('🔍 DEEP AUDIT OF ALL BOOKINGS & PAYMENT METHODS 🔍');
  console.log('=====================================================\n');

  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  const { data: growPayments, error: gErr } = await supabase.from('grow_incoming_payments').select('*');
  const { data: intakeRequests, error: iErr } = await supabase.from('intake_requests').select('*');

  if (bErr) console.error('Bookings error:', bErr);
  if (gErr) console.error('Grow error:', gErr);

  console.log(`Total Bookings in DB: ${bookings?.length || 0}`);
  console.log(`Total Grow Payments in DB: ${growPayments?.length || 0}`);
  console.log(`Total Intake Requests in DB: ${intakeRequests?.length || 0}\n`);

  console.log('--- 1. YANIV ELAD DETAILS ---');
  const yanivItems = (bookings || []).filter(b => {
    const o = (b.owner_name || b.data?.ownerName || '').toLowerCase();
    const d = (b.dog_name || b.data?.dogName || '').toLowerCase();
    const p = (b.owner_phone || b.data?.ownerPhone || '');
    return o.includes('יניב') || o.includes('אלעד') || p.includes('0545443222') || (d.includes('לונה') && !o.includes('שלומי'));
  });

  yanivItems.forEach(b => {
    console.log(`ID: ${b.id}`);
    console.log(`  Dog: ${b.dog_name || b.data?.dogName}`);
    console.log(`  Owner: ${b.owner_name || b.data?.ownerName} (${b.owner_phone || b.data?.ownerPhone})`);
    console.log(`  Dates: ${b.start_date || b.data?.startDate} -> ${b.end_date || b.data?.endDate}`);
    console.log(`  Total: ₪${b.total_price ?? b.data?.totalPrice} | Deposit: ₪${b.deposit_amount ?? b.data?.depositAmount} | Refund: ₪${b.refund_amount ?? b.data?.refundAmount}`);
    console.log(`  Payment Status: ${b.payment_status || b.data?.paymentStatus} | Method: ${b.payment_method || b.data?.paymentMethod}`);
    console.log(`  Stay Status: ${b.stay_status || b.data?.stayStatus}`);
    console.log(`  Notes: ${b.notes || b.data?.notes}`);
    console.log(`  Internal Notes: ${b.data?.internalNotes}`);
    console.log('--------------------------------------------------');
  });

  console.log('\n--- 2. ALL GROW PAYMENTS IN DB ---');
  (growPayments || []).forEach(g => {
    console.log(`[${g.reference_id || g.id}] Name: ${g.customer_name} | Phone: ${g.customer_phone} | Amount: ₪${g.amount} | Date: ${g.created_at || g.payment_date} | Status: ${g.status}`);
  });

  console.log('\n--- 3. ALL INTAKE REQUESTS MENTIONING GROW / PAYMENT ---');
  (intakeRequests || []).forEach(r => {
    const txt = `${r.owner_name || r.ownerName} ${r.dog_name || r.dogName} ${r.notes || ''} ${r.internal_notes || r.internalNotes || ''}`;
    if (txt.includes('grow') || txt.includes('אשראי') || txt.includes('סליקה') || txt.includes('תשלום') || txt.includes('לינק') || txt.includes('יניב')) {
      console.log(`Intake [${r.id}] Name: ${r.owner_name || r.ownerName} | Dog: ${r.dog_name || r.dogName} | Phone: ${r.owner_phone || r.ownerPhone} | Status: ${r.status} | DepositRequested: ${r.deposit_requested || r.depositRequested} | Notes: ${r.notes}`);
    }
  });

  console.log('\n--- 4. ALL 56 BOOKINGS CLASSIFICATION & PAYMENT METHOD ---');
  (bookings || []).forEach(b => {
    const d = b.data || {};
    const dog = b.dog_name || d.dogName || '';
    const owner = b.owner_name || d.ownerName || '';
    const phone = b.owner_phone || d.ownerPhone || '';
    const start = b.start_date || d.startDate || '';
    const end = b.end_date || d.endDate || '';
    const total = Number(b.total_price ?? d.totalPrice ?? 0);
    const dep = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const ref = Number(b.refund_amount ?? d.refundAmount ?? 0);
    const pStatus = b.payment_status || d.paymentStatus || '';
    const sStatus = b.stay_status || d.stayStatus || '';
    const method = b.payment_method || d.paymentMethod || '';
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).trim();

    console.log(`• [${b.id}] ${dog} (${owner}, ${phone}) | תאריכים: ${start}->${end} | סה"כ: ₪${total}, שולם: ₪${dep}, החזר: ₪${ref} | סטטוס: ${pStatus}/${sStatus} | שיטה: ${method} | הערות: ${notes}`);
  });
}

runAudit();

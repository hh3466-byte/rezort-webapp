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

async function fullCategorizationAudit() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  console.log('===============================================================');
  console.log('💎 100% PRECISE AUDIT & CLASSIFICATION OF ALL RESORT BOOKINGS 💎');
  console.log('===============================================================\n');

  const growLedgerRefs = [
    '4857277218', '173783725', '173758692', '514721903', '515223561',
    '174291549', '516299998', '171099384', '507419993', '4788806274',
    '507400049', '171140534', '507810263', '507807309', '4792995703',
    '507806497', '508467767', '508442380', '508390101', '508388527',
    '508629487', '4810894878', '171893936', '509363691', '171863155',
    '509681462', '4813075012', '510238566', '510464035', '510793633',
    '510777745', '510771399', '172804032', '173090500', '512844224',
    '175551443', '175543879', '517823870', '517029357', '516703080',
    '517441750', '4900844785'
  ];

  const categories = {
    growLink: [],
    directBank: [],
    installments: [],
    cashOnly: [],
    refunds: [],
    freeStays: []
  };

  bookings.forEach(b => {
    const d = b.data || {};
    const dog = b.dog_name || d.dogName || '';
    const owner = b.owner_name || d.ownerName || '';
    const phone = b.owner_phone || d.ownerPhone || '';
    const total = Number(b.total_price ?? d.totalPrice ?? 0);
    const dep = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const ref = Number(b.refund_amount ?? d.refundAmount ?? 0);
    const pStatus = b.payment_status || d.paymentStatus || '';
    const sStatus = b.stay_status || d.stayStatus || '';
    const method = b.payment_method || d.paymentMethod || '';
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).toLowerCase();
    const id = b.id || '';

    const item = { id, dog, owner, phone, total, dep, ref, pStatus, sStatus, method, notes };

    if (ref > 0) {
      categories.refunds.push(item);
    }

    if (total === 0 || notes.includes('חינם') || notes.includes('ללא תשלום') || (b.is_free_stay || d.isFreeStay)) {
      categories.freeStays.push(item);
      return;
    }

    // Direct Bank Transfers
    if (owner.includes('רונן') || owner.includes('מלמוד') || notes.includes('העברה בנקאית') || notes.includes('ישיר לחשבון')) {
      categories.directBank.push(item);
      return;
    }

    // Future Installments
    if ((owner.includes('דורין') && owner.includes('לוקס')) || dog.includes('מגן') || notes.includes('תשלום ראשון') || notes.includes('מתוך 4')) {
      categories.installments.push(item);
      return;
    }

    // Grow / Link / Credit / Bit (all online payments via Grow link)
    const isGrow = growLedgerRefs.some(r => notes.includes(r) || id.includes(r)) ||
      notes.includes('grow') || notes.includes('אסמכתא') || notes.includes('אשראי') || notes.includes('סליקה') ||
      notes.includes('לינק') || notes.includes('ביט') || notes.includes('bit') ||
      owner.includes('יניב') || owner.includes('אלעד') || owner.includes('בוריס') || owner.includes('ברנר') ||
      owner.includes('קארין') || owner.includes('להב') || owner.includes('רעות') || owner.includes('פויר') ||
      owner.includes('תם') || owner.includes('דנינו') || owner.includes('יונתן') || owner.includes('וולפין') ||
      owner.includes('איתי') || owner.includes('אהרונסון');

    if (isGrow) {
      categories.growLink.push(item);
      return;
    }

    // Explicit Cash
    if (method === 'cash' || notes.includes('מזומן') || notes.includes('שטרות')) {
      categories.cashOnly.push(item);
      return;
    }

    // If fully paid or deposit paid without Grow/Bank/Cash keyword:
    // Let's inspect these remaining bookings
    categories.cashOnly.push({ ...item, isUnclassified: true });
  });

  console.log(`\n=== 1. GROW LINK & DIGITAL PAYMENTS (${categories.growLink.length}) ===`);
  categories.growLink.forEach(c => console.log(`  📱 [${c.id}] ${c.dog} | ${c.owner} (${c.phone}) | ₪${c.dep || c.total} | ${c.notes.substring(0, 70)}`));

  console.log(`\n=== 2. DIRECT BANK TRANSFERS (${categories.directBank.length}) ===`);
  categories.directBank.forEach(c => console.log(`  🏛️ [${c.id}] ${c.dog} | ${c.owner} (${c.phone}) | ₪${c.dep || c.total} | ${c.notes.substring(0, 70)}`));

  console.log(`\n=== 3. FUTURE INSTALLMENTS (${categories.installments.length}) ===`);
  categories.installments.forEach(c => console.log(`  🗓️ [${c.id}] ${c.dog} | ${c.owner} (${c.phone}) | ₪${c.dep || c.total} | ${c.notes.substring(0, 70)}`));

  console.log(`\n=== 4. CASH PAYMENTS (${categories.cashOnly.length}) ===`);
  categories.cashOnly.forEach(c => console.log(`  💵 [${c.id}] ${c.dog} | ${c.owner} (${c.phone}) | ₪${c.dep || c.total} | ${c.notes.substring(0, 70)} ${c.isUnclassified ? '⚠️ UNCLASSIFIED' : ''}`));

  console.log(`\n=== 5. REFUNDS (${categories.refunds.length}) ===`);
  categories.refunds.forEach(c => console.log(`  ↩️ [${c.id}] ${c.dog} | ${c.owner} (${c.phone}) | החזר: ₪${c.ref}`));
}

fullCategorizationAudit();

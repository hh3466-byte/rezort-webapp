const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^['\"]|['\"]$/g, '');
});
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Known verified Grow transactions by month
const GROW_TRANSACTIONS = [
  // September 2026 (7 transactions = 8,415)
  { ref: '4857277218', amount: 180, date: '2026-09-02', month: '2026-09', dog: 'אוניל', owner: 'גל שרה שמש בן יוסף' },
  { ref: '173783725', amount: 180, date: '2026-09-06', month: '2026-09', dog: 'הדס', owner: 'נטע הדס' },
  { ref: '173758692', amount: 180, date: '2026-09-06', month: '2026-09', dog: "ג'סי הרוטוויילרית", owner: 'ריקה נברי' },
  { ref: '514721903', amount: 6300, date: '2026-09-06', month: '2026-09', dog: 'תיאו', owner: 'איל שקל' },
  { ref: '515223561', amount: 360, date: '2026-09-07', month: '2026-09', dog: 'ספסוף', owner: 'בני גרין' },
  { ref: '174291549', amount: 540, date: '2026-09-10', month: '2026-09', dog: 'פאבלו', owner: 'Tali Nisan Avramov' },
  { ref: '516299998', amount: 675, date: '2026-09-11', month: '2026-09', dog: 'מגן', owner: 'דורין לוקס' },

  // August 2026 (28 transactions = 25,370)
  { ref: '171099384', amount: 2200, date: '2026-08-09', month: '2026-08', dog: 'ריפמן' },
  { ref: '507419993', amount: 180, date: '2026-08-10', month: '2026-08', dog: 'גפני' },
  { ref: '4788806274', amount: 900, date: '2026-08-10', month: '2026-08', dog: 'דיין' },
  { ref: '507400049', amount: 200, date: '2026-08-10', month: '2026-08', dog: 'שקל' },
  { ref: '171140534', amount: 180, date: '2026-08-10', month: '2026-08', dog: 'מוסקוביץ' },
  { ref: '507810263', amount: 1500, date: '2026-08-11', month: '2026-08', dog: "ג'וי" },
  { ref: '507807309', amount: 1000, date: '2026-08-11', month: '2026-08', dog: "ג'וי" },
  { ref: '4792995703', amount: 1000, date: '2026-08-11', month: '2026-08', dog: "ג'וי" },
  { ref: '507806497', amount: 3000, date: '2026-08-11', month: '2026-08', dog: "ג'וי" },
  { ref: '508467767', amount: 180, date: '2026-08-13', month: '2026-08', dog: 'אלקחר' },
  { ref: '508442380', amount: 540, date: '2026-08-13', month: '2026-08', dog: 'אמיר' },
  { ref: '508390101', amount: 180, date: '2026-08-13', month: '2026-08', dog: 'זיסו' },
  { ref: '508388527', amount: 180, date: '2026-08-13', month: '2026-08', dog: 'זיסו' },
  { ref: '508629487', amount: 180, date: '2026-08-14', month: '2026-08', dog: 'סיני' },
  { ref: '4810894878', amount: 1950, date: '2026-08-17', month: '2026-08', dog: 'שביט' },
  { ref: '171893936', amount: 1170, date: '2026-08-17', month: '2026-08', dog: 'מוסקוביץ' },
  { ref: '509363691', amount: 2550, date: '2026-08-17', month: '2026-08', dog: 'נברי' },
  { ref: '171863155', amount: 360, date: '2026-08-17', month: '2026-08', dog: 'וונטש' },
  { ref: '509681462', amount: 540, date: '2026-08-18', month: '2026-08', dog: 'אשורי' },
  { ref: '4813075012', amount: 1050, date: '2026-08-18', month: '2026-08', dog: 'בוגטירב' },
  { ref: '510238566', amount: 300, date: '2026-08-20', month: '2026-08', dog: 'קובלנקו' },
  { ref: '510464035', amount: 1770, date: '2026-08-21', month: '2026-08', dog: 'אלקחר' },
  { ref: '510793633', amount: 180, date: '2026-08-23', month: '2026-08', dog: 'גיל' },
  { ref: '510777745', amount: 1740, date: '2026-08-23', month: '2026-08', dog: 'זיסו' },
  { ref: '510771399', amount: 270, date: '2026-08-23', month: '2026-08', dog: 'נידרי' },
  { ref: '172804032', amount: 540, date: '2026-08-27', month: '2026-08', dog: 'לוטם' },
  { ref: '173090500', amount: 1350, date: '2026-08-30', month: '2026-08', dog: 'ונוס' },
  { ref: '512844224', amount: 180, date: '2026-08-30', month: '2026-08', dog: 'קירה' }
];

function getMonthlyFinancials(targetMonth, bookings, incomingGrow = []) {
  // 1. Grow Cleared (sum of verified Grow transactions this month)
  // Check GROW_TRANSACTIONS + any dynamic incomingGrow in that month
  let growSum = 0;
  const processedRefs = new Set();

  GROW_TRANSACTIONS.filter(t => t.month === targetMonth || t.date.startsWith(targetMonth)).forEach(t => {
    growSum += t.amount;
    processedRefs.add(t.ref);
  });

  incomingGrow.forEach(g => {
    const ref = g.reference_id || g.id;
    if (!processedRefs.has(ref)) {
      const gMonth = (g.created_at || '').substring(0, 7);
      if (gMonth === targetMonth) {
        growSum += Number(g.amount) || 0;
        processedRefs.add(ref);
      }
    }
  });

  // 2. Cash / Direct Cleared this month
  // Any booking active or updated in this month that was paid outside Grow
  let cashSum = 0;
  const cashDetails = [];

  bookings.forEach(b => {
    const d = b.data || {};
    const notes = (b.notes || d.notes || '') + ' ' + (d.internalNotes || '');
    const stayStatus = b.stay_status || d.stayStatus;
    const paymentStatus = b.payment_status || d.paymentStatus;
    const total = Number(b.total_price ?? d.totalPrice ?? 0);
    const dep = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const payMethod = b.payment_method || d.paymentMethod;

    if (stayStatus === 'cancelled' || paymentStatus === 'unpaid' || total <= 0) return;

    // Is booking relevant to targetMonth?
    const start = b.start_date || d.startDate || '';
    const end = b.end_date || d.endDate || '';
    const created = (b.created_at || d.createdAt || '').substring(0, 7);
    const updated = (b.updated_at || d.updatedAt || '').substring(0, 7);
    const depPaid = (b.deposit_paid_at || d.depositPaidAt || '').substring(0, 7);

    const isInMonth = start.startsWith(targetMonth) || end.startsWith(targetMonth) || created === targetMonth || depPaid === targetMonth;
    if (!isInMonth) return;

    // Check if matched to a Grow transaction
    const matchedGrow = GROW_TRANSACTIONS.find(t => notes.includes(t.ref) || b.id.includes(t.ref));

    if (matchedGrow) {
      // If booking was matched to a Grow transaction in another month (e.g. Joy in August), do not count as September cash
      if (matchedGrow.month !== targetMonth) {
        return;
      }
      // If booking was in this month's Grow, check if there is an excess cash difference (e.g. Dorin Lucas 2700 - 675 = 2025)
      const collected = paymentStatus === 'fully_paid' ? total : dep;
      const diff = collected - matchedGrow.amount;
      if (diff > 0) {
        cashSum += diff;
        cashDetails.push({ dog: b.dog_name || d.dogName, owner: b.owner_name || d.ownerName, amount: diff, reason: 'הפרש תשלום מעבר ל-Grow' });
      }
      return;
    }

    // Not matched to Grow at all -> Cash / Bit direct / Bank transfer
    const collected = paymentStatus === 'fully_paid' ? total : dep;
    if (collected > 0) {
      cashSum += collected;
      cashDetails.push({ dog: b.dog_name || d.dogName, owner: b.owner_name || d.ownerName, amount: collected, method: payMethod });
    }
  });

  return { growSum, cashSum, cashDetails };
}

async function run() {
  const { data: bookings } = await sb.from('bookings').select('*');
  const resSep = getMonthlyFinancials('2026-09', bookings);
  console.log('September 2026:', { grow: resSep.growSum, cash: resSep.cashSum });
  console.log('Cash items count:', resSep.cashDetails.length);
  resSep.cashDetails.forEach(c => console.log(`  - ${c.dog} (${c.owner}): ₪${c.amount} [${c.method || c.reason}]`));

  const resAug = getMonthlyFinancials('2026-08', bookings);
  console.log('\nAugust 2026:', { grow: resAug.growSum, cash: resAug.cashSum });
}
run();

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^['\"]|['\"]$/g, '');
});
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const VERIFIED_GROW_LEDGER = [
  // September 2026 Grow transactions (13 confirmed items = ₪14,548) - will enter bank on 10.10.2026
  { ref: '4857277218', amount: 180, date: '2026-09-02', month: '2026-09', customerName: 'גל שרה שמש בן יוסף', dogName: 'אוניל' },
  { ref: '173760086', amount: 400, date: '2026-09-06', month: '2026-09', customerName: 'נתנאל קרטה', dogName: 'קרטה' },
  { ref: '173783725', amount: 180, date: '2026-09-06', month: '2026-09', customerName: 'נטע הדס', dogName: 'הדס' },
  { ref: '173758692', amount: 180, date: '2026-09-06', month: '2026-09', customerName: 'ריקה נברי', dogName: "ג'סי הרוטוויילרית" },
  { ref: '514721903', amount: 6300, date: '2026-09-06', month: '2026-09', customerName: 'איל שקל', dogName: 'תיאו' },
  { ref: '515223561', amount: 360, date: '2026-09-07', month: '2026-09', customerName: 'בני גרין', dogName: 'ספסוף' },
  { ref: '174291549', amount: 540, date: '2026-09-10', month: '2026-09', customerName: 'Tali Nisan Avramov', dogName: 'פאבלו' },
  { ref: '516299998', amount: 2700, date: '2026-09-11', month: '2026-09', customerName: 'דורין לוקס', dogName: 'מגן' },
  { ref: '516703080', amount: 990, date: '2026-09-14', month: '2026-09', customerName: 'יניב אלעד', dogName: "ג'נגו" },
  { ref: '4888806968', amount: 108, date: '2026-09-14', month: '2026-09', customerName: 'גל שרה שמש בן יוסף', dogName: 'אוניל' },
  { ref: '517029357', amount: 540, date: '2026-09-15', month: '2026-09', customerName: 'תם דנינו', dogName: 'מימי רוז' },
  { ref: '517441750', amount: 720, date: '2026-09-16', month: '2026-09', customerName: 'יונתן וולפין', dogName: 'זיפו' },
  { ref: '517823870', amount: 1350, date: '2026-09-17', month: '2026-09', customerName: 'רעות פויר', dogName: 'טר' },

  // August 2026 (28 items, total: 25,370) - entered bank on 10.09.2026
  { ref: '171099384', amount: 2200, date: '2026-08-09', month: '2026-08', customerName: 'אשר ריפמן', dogName: 'ריפמן' },
  { ref: '507419993', amount: 180, date: '2026-08-10', month: '2026-08', customerName: 'נאוה גפני', dogName: 'גפני' },
  { ref: '4788806274', amount: 900, date: '2026-08-10', month: '2026-08', customerName: 'דינה דיין', dogName: 'דיין' },
  { ref: '507400049', amount: 200, date: '2026-08-10', month: '2026-08', customerName: 'תיאן שקל', dogName: 'שקל' },
  { ref: '171140534', amount: 180, date: '2026-08-10', month: '2026-08', customerName: 'דליה מוסקוביץ', dogName: 'מוסקוביץ' },
  { ref: '507810263', amount: 1500, date: '2026-08-11', month: '2026-08', customerName: 'ירוס ביקאיה', dogName: "ג'וי" },
  { ref: '507807309', amount: 1000, date: '2026-08-11', month: '2026-08', customerName: 'ירוס ביקאיה', dogName: "ג'וי" },
  { ref: '4792995703', amount: 1000, date: '2026-08-11', month: '2026-08', customerName: 'ירוס ביקאיה', dogName: "ג'וי" },
  { ref: '507806497', amount: 3000, date: '2026-08-11', month: '2026-08', customerName: 'ירוס ביקאיה', dogName: "ג'וי" },
  { ref: '508467767', amount: 180, date: '2026-08-13', month: '2026-08', customerName: 'דוד אלקחר', dogName: 'אלקחר' },
  { ref: '508442380', amount: 540, date: '2026-08-13', month: '2026-08', customerName: 'Lior Amir', dogName: 'אמיר' },
  { ref: '508390101', amount: 180, date: '2026-08-13', month: '2026-08', customerName: 'זיו זיסו', dogName: 'זיסו' },
  { ref: '508388527', amount: 180, date: '2026-08-13', month: '2026-08', customerName: 'זיו זיסו', dogName: 'זיסו' },
  { ref: '508629487', amount: 180, date: '2026-08-14', month: '2026-08', customerName: 'מלי סיני', dogName: 'סיני' },
  { ref: '4810894878', amount: 1950, date: '2026-08-17', month: '2026-08', customerName: 'עידו שביט', dogName: 'שביט' },
  { ref: '171893936', amount: 1170, date: '2026-08-17', month: '2026-08', customerName: 'דליה מוסקוביץ', dogName: 'מוסקוביץ' },
  { ref: '509363691', amount: 2550, date: '2026-08-17', month: '2026-08', customerName: 'אור נברי', dogName: 'נברי' },
  { ref: '171863155', amount: 360, date: '2026-08-17', month: '2026-08', customerName: 'ירדן וונטש', dogName: 'וונטש' },
  { ref: '509681462', amount: 540, date: '2026-08-18', month: '2026-08', customerName: 'יובל אשורי', dogName: 'אשורי' },
  { ref: '4813075012', amount: 1050, date: '2026-08-18', month: '2026-08', customerName: 'אלכס בוגטירב', dogName: 'בוגטירב' },
  { ref: '510238566', amount: 300, date: '2026-08-20', month: '2026-08', customerName: 'ליקה קובלנקו', dogName: 'קובלנקו' },
  { ref: '510464035', amount: 1770, date: '2026-08-21', month: '2026-08', customerName: 'דוד אלקחר', dogName: 'אלקחר' },
  { ref: '510793633', amount: 180, date: '2026-08-23', month: '2026-08', customerName: 'עירן אברהם גיל', dogName: 'גיל' },
  { ref: '510777745', amount: 1740, date: '2026-08-23', month: '2026-08', customerName: 'זיו זיסו', dogName: 'זיסו' },
  { ref: '510771399', amount: 270, date: '2026-08-23', month: '2026-08', customerName: 'אופיר נידרי', dogName: 'נידרי' },
  { ref: '172804032', amount: 540, date: '2026-08-27', month: '2026-08', customerName: 'עומר לוטם', dogName: 'לוטם' },
  { ref: '173090500', amount: 1350, date: '2026-08-30', month: '2026-08', customerName: 'אלי קובי', dogName: 'ונוס' },
  { ref: '512844224', amount: 180, date: '2026-08-30', month: '2026-08', customerName: 'ישראל מנדל', dogName: 'קירה' }
];

async function run() {
  const { data: bookings } = await sb.from('bookings').select('*');
  const targetMonthKey = '2026-09';

  let growCleared = 0;
  let growPaidCount = 0;
  VERIFIED_GROW_LEDGER.forEach(t => {
    if (t.month === targetMonthKey) {
      growCleared += t.amount;
      growPaidCount++;
    }
  });

  let cashCollected = 0;
  let cashPaidCount = 0;
  const cashItems = [];

  bookings.forEach(b => {
    const d = b.data || {};
    const dog = b.dog_name || d.dogName || '';
    const owner = b.owner_name || d.ownerName || '';
    const total = Number(b.total_price ?? d.totalPrice ?? 0);
    const dep = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const payStatus = b.payment_status || d.paymentStatus;
    const stayStatus = b.stay_status || d.stayStatus;
    const start = b.start_date || d.startDate || '';
    const end = b.end_date || d.endDate || '';
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).trim();

    if (stayStatus === 'cancelled' || payStatus === 'unpaid' || total <= 0) return;
    if (dog.includes("ג'וי") || dog.includes("גו'י")) return;

    // Check if matched to verified Grow
    const isGrow = VERIFIED_GROW_LEDGER.some(t => notes.includes(t.ref) || b.id.includes(t.ref));
    if (isGrow) return;

    // Ronen Malamud (Miluim direct bank transfer)
    if (owner.includes('רונן') || owner.includes('מלמוד')) return;

    // Future booking (November)
    if (start.startsWith('2026-11')) return;

    // Check if active in September
    const isSep = start.startsWith('2026-09') || end.startsWith('2026-09');
    if (!isSep) return;

    const amt = payStatus === 'fully_paid' ? total : dep;
    if (amt > 0) {
      cashCollected += amt;
      cashPaidCount++;
      cashItems.push({ dog, owner, amt, start, end });
    }
  });

  console.log('=== VERIFIED NUMBERS ===');
  console.log(`GROW (נכנס ב-10.10 לבנק): ₪${growCleared.toLocaleString()} (${growPaidCount} עסקאות)`);
  console.log(`מזומן / ביט ישיר אמיתי: ₪${cashCollected.toLocaleString()} (${cashPaidCount} עסקאות)`);
  console.log('פריטי המזומן/ביט הישיר:');
  cashItems.forEach(c => console.log(`  - ${c.dog} (${c.owner}): ₪${c.amt.toLocaleString()}`));
}
run();

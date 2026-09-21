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
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  // Also check all ledger data
  const ledgerData = [
    { ref: '4857277218', paid: 180, phone: '0522458841', name: 'גל שרה שמש בן יוסף', date: '2026-09-02', dog: 'אוניל' },
    { ref: '173783725', paid: 180, phone: '0526444845', name: 'נטע הדס', date: '2026-09-06', dog: 'הדס' },
    { ref: '173758692', paid: 180, phone: '0527777737', name: 'ריקה נברי', date: '2026-09-06', dog: "ג'סי הרוטוויילרית" },
    { ref: '514721903', paid: 6300, phone: '0505564073', name: 'איל שקל', date: '2026-09-06', dog: 'תיאו' },
    { ref: '515223561', paid: 360, phone: '0505856800', name: 'בני גרין', date: '2026-09-07', dog: 'ספסוף' },
    { ref: '174291549', paid: 540, phone: '0508273209', name: 'Tali Nisan Avramov', date: '2026-09-10', dog: 'פאבלו' },
    { ref: '516299998', paid: 675, phone: '0529270115', name: 'דורין לוקס', date: '2026-09-11', dog: 'מגן' },
    { ref: '171099384', paid: 2200, phone: '0549420995', name: 'אשר ריפמן', date: '2026-08-09', dog: 'ריפמן' },
    { ref: '507419993', paid: 180, phone: '0545949480', name: 'נאוה גפני', date: '2026-08-10', dog: 'גפני' },
    { ref: '4788806274', paid: 900, phone: '0527204572', name: 'דינה דיין', date: '2026-08-10', dog: 'דיין' },
    { ref: '507400049', paid: 200, phone: '0545670355', name: 'תיאן שקל', date: '2026-08-10', dog: 'שקל' },
    { ref: '171140534', paid: 180, phone: '0523669361', name: 'דליה מוסקוביץ', date: '2026-08-10', dog: 'מוסקוביץ' },
    { ref: '507810263', paid: 1500, phone: '0556646093', name: 'ירוס ביקאיה', date: '2026-08-11', dog: "ג'וי" },
    { ref: '507807309', paid: 1000, phone: '0556646093', name: 'ירוס ביקאיה', date: '2026-08-11', dog: "ג'וי" },
    { ref: '4792995703', paid: 1000, phone: '0556646093', name: 'ירוס ביקאיה', date: '2026-08-11', dog: "ג'וי" },
    { ref: '507806497', paid: 3000, phone: '0556646093', name: 'ירוס ביקאיה', date: '2026-08-11', dog: "ג'וי" },
    { ref: '508467767', paid: 180, phone: '0542211442', name: 'דוד אלקחר', date: '2026-08-13', dog: 'אלקחר' },
    { ref: '508442380', paid: 540, phone: '0503166129', name: 'Lior Amir', date: '2026-08-13', dog: 'אמיר' },
    { ref: '508390101', paid: 180, phone: '0524577752', name: 'זיו זיסו', date: '2026-08-13', dog: 'זיסו' },
    { ref: '508388527', paid: 180, phone: '0524577752', name: 'זיו זיסו', date: '2026-08-13', dog: 'זיסו' },
    { ref: '508629487', paid: 180, phone: '0507585533', name: 'מלי סיני', date: '2026-08-14', dog: 'סיני' },
    { ref: '4810894878', paid: 1950, phone: '0546260997', name: 'עידו שביט', date: '2026-08-17', dog: 'שביט' },
    { ref: '171893936', paid: 1170, phone: '0523669361', name: 'דליה מוסקוביץ', date: '2026-08-17', dog: 'מוסקוביץ' },
    { ref: '509363691', paid: 2550, phone: '0527777787', name: 'אור נברי', date: '2026-08-17', dog: 'נברי' },
    { ref: '171863155', paid: 360, phone: '0523752473', name: 'ירדן וונטש', date: '2026-08-17', dog: 'וונטש' },
    { ref: '509681462', paid: 540, phone: '0526757615', name: 'יובל אשורי', date: '2026-08-18', dog: 'אשורי' },
    { ref: '4813075012', paid: 1050, phone: '0507729993', name: 'אלכס בוגטירב', date: '2026-08-18', dog: 'בוגטירב' },
    { ref: '510238566', paid: 300, phone: '0504858039', name: 'ליקה קובלנקו', date: '2026-08-20', dog: 'קובלנקו' },
    { ref: '510464035', paid: 1770, phone: '0542211442', name: 'דוד אלקחר', date: '2026-08-21', dog: 'אלקחר' },
    { ref: '510793633', paid: 180, phone: '0547778221', name: 'עירן אברהם גיל', date: '2026-08-23', dog: 'גיל' },
    { ref: '510777745', paid: 1740, phone: '0524577752', name: 'זיו זיסו', date: '2026-08-23', dog: 'זיסו' },
    { ref: '510771399', paid: 270, phone: '0502244873', name: 'אופיר נידרי', date: '2026-08-23', dog: 'נידרי' },
    { ref: '172804032', paid: 540, phone: '0524399271', name: 'עומר לוטם', date: '2026-08-27', dog: 'לוטם' },
    { ref: '173090500', paid: 1350, phone: '0546160220', name: 'אלי קובי', date: '2026-08-30', dog: 'ונוס' },
    { ref: '512844224', paid: 180, phone: '0505642501', name: 'ישראל מנדל', date: '2026-08-30', dog: 'קירה' }
  ];

  const allGrow = [...(growPayments || [])];
  ledgerData.forEach(l => {
    if (!allGrow.some(g => (g.reference_id || g.id) === l.ref)) {
      allGrow.push({
        reference_id: l.ref,
        amount: l.paid,
        customer_phone: l.phone,
        customer_name: l.name
      });
    }
  });

  const detailedList = [];

  bookings.forEach(b => {
    const d = b.data || {};
    const dog = b.dog_name || d.dogName;
    const owner = b.owner_name || d.ownerName;
    const phone = cleanPhone(b.owner_phone || d.ownerPhone);
    const p7 = phone.slice(-7);
    const totalPrice = Number(b.total_price ?? d.totalPrice ?? 0);
    const depositAmount = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const paymentStatus = b.payment_status || d.paymentStatus;
    const stayStatus = b.stay_status || d.stayStatus;
    const notes = ((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).trim();

    if (stayStatus === 'cancelled') return;

    let collected = 0;
    if (paymentStatus === 'fully_paid') {
      collected = totalPrice > 0 ? totalPrice : depositAmount;
    } else {
      collected = depositAmount;
    }

    // Match grow payments
    const matchedGrow = allGrow.filter(g => {
      const gp = cleanPhone(g.customer_phone).slice(-7);
      if (gp && p7 && gp === p7) return true;
      const ref = String(g.reference_id || g.id);
      if (ref && notes.includes(ref)) return true;
      if (b.id && b.id.includes(ref)) return true;
      return false;
    });

    const growSum = matchedGrow.reduce((s, g) => s + Number(g.amount || 0), 0);
    const diff = Math.max(0, collected - growSum);

    detailedList.push({
      id: b.id,
      dog,
      owner,
      phone,
      totalPrice,
      collected,
      growSum,
      diff,
      paymentStatus,
      stayStatus,
      matchedCount: matchedGrow.length,
      notes
    });
  });

  console.log('=== ALL ITEMS WHERE COLLECTED > GROW SUM (POTENTIAL CASH / MANUAL CLOSURES) ===');
  const cashCandidates = detailedList.filter(item => item.diff > 0);
  let totalCashDiff = 0;
  cashCandidates.forEach(c => {
    totalCashDiff += c.diff;
    console.log(`• [${c.id}] כלב: ${c.dog} | בעלים: ${c.owner} (${c.phone}) | סה"כ נדרש: ₪${c.totalPrice} | נגבה: ₪${c.collected} | שולם ב-Grow: ₪${c.growSum} | הפרש (מזומן/מחוץ ל-Grow): ₪${c.diff} | סטטוס: ${c.paymentStatus} (${c.stayStatus})`);
  });
  console.log(`\n>>> סה"כ הפרש ששולם במזומן / נסגר ללא Grow: ₪${totalCashDiff.toLocaleString()} <<<`);
}

run();

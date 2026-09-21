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

// Ledger data of all confirmed Grow transactions
const ledgerData = [
  // September 2026 Grow transactions
  { ref: '4857277218', paid: 180, phone: '0522458841', name: 'גל שרה שמש בן יוסף', date: '2026-09-02', month: 'ספטמבר', dog: 'אוניל' },
  { ref: '173783725', paid: 180, phone: '0526444845', name: 'נטע הדס', date: '2026-09-06', month: 'ספטמבר', dog: 'הדס' },
  { ref: '173758692', paid: 180, phone: '0527777737', name: 'ריקה נברי', date: '2026-09-06', month: 'ספטמבר', dog: "ג'סי הרוטוויילרית" },
  { ref: '514721903', paid: 6300, phone: '0505564073', name: 'איל שקל', date: '2026-09-06', month: 'ספטמבר', dog: 'תיאו' },
  { ref: '515223561', paid: 360, phone: '0505856800', name: 'בני גרין', date: '2026-09-07', month: 'ספטמבר', dog: 'ספסוף' },
  { ref: '174291549', paid: 540, phone: '0508273209', name: 'Tali Nisan Avramov', date: '2026-09-10', month: 'ספטמבר', dog: 'פאבלו' },
  { ref: '516299998', paid: 675, phone: '0529270115', name: 'דורין לוקס', date: '2026-09-11', month: 'ספטמבר', dog: 'מגן' },

  // August 2026 Grow transactions (cleared into bank on 10.09.2026!)
  { ref: '171099384', paid: 2200, phone: '0549420995', name: 'אשר ריפמן', date: '2026-08-09', month: 'אוגוסט', dog: 'ריפמן' },
  { ref: '507419993', paid: 180, phone: '0545949480', name: 'נאוה גפני', date: '2026-08-10', month: 'אוגוסט', dog: 'גפני' },
  { ref: '4788806274', paid: 900, phone: '0527204572', name: 'דינה דיין', date: '2026-08-10', month: 'אוגוסט', dog: 'דיין' },
  { ref: '507400049', paid: 200, phone: '0545670355', name: 'תיאן שקל', date: '2026-08-10', month: 'אוגוסט', dog: 'שקל' },
  { ref: '171140534', paid: 180, phone: '0523669361', name: 'דליה מוסקוביץ', date: '2026-08-10', month: 'אוגוסט', dog: 'מוסקוביץ' },
  { ref: '507810263', paid: 1500, phone: '0556646093', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי" },
  { ref: '507807309', paid: 1000, phone: '0556646093', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי" },
  { ref: '4792995703', paid: 1000, phone: '0556646093', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי" },
  { ref: '507806497', paid: 3000, phone: '0556646093', name: 'ירוס ביקאיה', date: '2026-08-11', month: 'אוגוסט', dog: "ג'וי" },
  { ref: '508467767', paid: 180, phone: '0542211442', name: 'דוד אלקחר', date: '2026-08-13', month: 'אוגוסט', dog: 'אלקחר' },
  { ref: '508442380', paid: 540, phone: '0503166129', name: 'Lior Amir', date: '2026-08-13', month: 'אוגוסט', dog: 'אמיר' },
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

function getBookingPaymentsInMonth(b, targetMonthKey) {
  const d = b.data || {};
  const stayStatus = b.stay_status || d.stayStatus;
  const paymentStatus = b.payment_status || d.paymentStatus;
  const totalPrice = Number(b.total_price ?? d.totalPrice ?? 0);
  const depAmount = Number(b.deposit_amount ?? d.depositAmount ?? 0);

  if (stayStatus === 'cancelled' || paymentStatus === 'unpaid' || totalPrice <= 0) {
    return 0;
  }

  let collectedInMonth = 0;
  const depositDate = b.deposit_paid_at || d.depositPaidAt || b.created_at || d.createdAt || b.start_date || d.startDate || '';
  const depositMonth = depositDate.substring(0, 7);

  if (paymentStatus === 'fully_paid') {
    const isPaidUpfront = !b.updated_at || 
      b.updated_at === b.created_at || 
      (d.fullyPaidAt === d.depositPaidAt) || 
      ((b.notes || d.notes || '').includes('עסקת Grow')) || 
      (depAmount >= totalPrice);

    if (isPaidUpfront || depAmount >= totalPrice) {
      if (depositMonth === targetMonthKey) {
        collectedInMonth += totalPrice;
      }
    } else {
      if (depositMonth === targetMonthKey) {
        collectedInMonth += depAmount;
      }
      const finalDate = b.fully_paid_at || d.fullyPaidAt || b.updated_at || d.updatedAt || b.end_date || d.endDate || '';
      const finalMonth = finalDate.substring(0, 7);
      if (finalMonth === targetMonthKey) {
        collectedInMonth += Math.max(0, totalPrice - depAmount);
      }
    }
  } else if (paymentStatus === 'deposit_paid') {
    if (depositMonth === targetMonthKey) {
      collectedInMonth += depAmount;
    }
  }

  return collectedInMonth;
}

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: growTable } = await supabase.from('grow_incoming_payments').select('*');

  const targetMonth = '2026-09';
  console.log(`=== ANALYZING SEPTEMBER 2026 REVENUE CARD (₪36,566) ===\n`);

  // 1. Gather all bookings counted in September
  const septemberBookings = [];
  let totalSeptemberCard = 0;

  bookings.forEach(b => {
    const d = b.data || {};
    const amt = getBookingPaymentsInMonth(b, targetMonth);
    if (amt > 0) {
      totalSeptemberCard += amt;
      septemberBookings.push({
        id: b.id,
        dog: b.dog_name || d.dogName,
        owner: b.owner_name || d.ownerName,
        phone: b.owner_phone || d.ownerPhone,
        totalPrice: Number(b.total_price ?? d.totalPrice ?? 0),
        depositAmount: Number(b.deposit_amount ?? d.depositAmount ?? 0),
        paymentStatus: b.payment_status || d.paymentStatus,
        paymentMethod: b.payment_method || d.paymentMethod,
        startDate: b.start_date || d.startDate,
        endDate: b.end_date || d.endDate,
        createdAt: b.created_at || d.createdAt,
        notes: (b.notes || d.notes || '') + ' ' + (d.internalNotes || ''),
        countedAmount: amt
      });
    }
  });

  console.log(`Total Bookings Counted in Card: ${septemberBookings.length}`);
  console.log(`Total Card Revenue: ₪${totalSeptemberCard.toLocaleString()}\n`);

  // 2. Identify actual September Grow transactions (charged in September -> entering bank on 10.10)
  const septemberGrowTransactions = ledgerData.filter(l => l.month === 'ספטמבר' || l.date.startsWith('2026-09'));
  const septemberGrowSum = septemberGrowTransactions.reduce((acc, g) => acc + g.paid, 0);

  console.log('--- 1. ACTUAL GROW TRANSACTIONS IN SEPTEMBER 2026 (WILL ENTER BANK ON 10.10) ---');
  console.log(`Count: ${septemberGrowTransactions.length}, Total: ₪${septemberGrowSum.toLocaleString()}`);
  septemberGrowTransactions.forEach(g => {
    console.log(`• אסמכתא: ${g.ref} | תאריך: ${g.date} | לקוח: ${g.name} | כלב: ${g.dog} | סכום ששולם ב-Grow: ₪${g.paid.toLocaleString()}`);
  });

  // 3. Breakdown of the ₪36,566 in the September card:
  console.log('\n--- 2. DETAILED BREAKDOWN OF THE ₪36,566 IN THE CARD ---');
  let realSeptemberGrowInCard = 0;
  let augustGrowInCard = 0;
  let cashOrDirectInCard = 0;
  let theoreticalOrUnverifiedInCard = 0;

  septemberBookings.forEach(b => {
    const phone7 = cleanPhone(b.phone).slice(-7);
    const notes = b.notes;
    
    // Check if matched to a September Grow
    const matchedSepGrow = septemberGrowTransactions.find(g => {
      const g7 = cleanPhone(g.phone).slice(-7);
      return (g7 && g7 === phone7) || (notes && notes.includes(g.ref)) || b.id.includes(g.ref);
    });

    // Check if matched to an August Grow (already entered bank on 10.09!)
    const matchedAugGrow = ledgerData.filter(l => l.month === 'אוגוסט').find(g => {
      const g7 = cleanPhone(g.phone).slice(-7);
      return (g7 && g7 === phone7) || (notes && notes.includes(g.ref)) || b.id.includes(g.ref);
    });

    let category = '';
    if (matchedSepGrow) {
      category = '✅ שולם ב-GROW בספטמבר (ייכנס לבנק ב-10.10)';
      realSeptemberGrowInCard += b.countedAmount;
    } else if (matchedAugGrow) {
      category = '⚠️ שולם ב-GROW באוגוסט! (כבר נכנס לבנק ב-10.09, נספר בכרטיס בגלל תאריך)';
      augustGrowInCard += b.countedAmount;
    } else if (b.paymentMethod === 'cash' || notes.includes('מזומן') || b.paymentMethod === 'bit' || b.paymentMethod === 'bank_transfer') {
      category = '💵 שולם במזומן / ביט / ישיר (נכנס ישירות, לא ייכנס מ-Grow ב-10.10)';
      cashOrDirectInCard += b.countedAmount;
    } else {
      category = '❓ רישום מערכת ללא מייל Grow';
      theoreticalOrUnverifiedInCard += b.countedAmount;
    }

    console.log(`[${b.dog} - ${b.owner}] נספר בכרטיס: ₪${b.countedAmount.toLocaleString()} | תאריכים: ${b.startDate} עד ${b.endDate} | שיטה: ${b.paymentMethod} | סטטוס: ${b.paymentStatus} | ${category}`);
  });

  console.log('\n========================================================================');
  console.log('סיכום מסקנות ברור לשאלת המשתמש:');
  console.log(`1. סה"כ בכרטיס "הכנסות החודש": ₪${totalSeptemberCard.toLocaleString()}`);
  console.log(`2. מתוכם תשלומים שאכן שולמו ב-GROW בספטמבר (וייכנסו לבנק ב-10.10): ₪${realSeptemberGrowInCard.toLocaleString()}`);
  console.log(`3. מתוכם תשלומי GROW מאוגוסט שנספרו בכרטיס: ₪${augustGrowInCard.toLocaleString()}`);
  console.log(`4. מתוכם תשלומים במזומן / ביט ישיר / העברה (שלא עוברים דרך GROW): ₪${cashOrDirectInCard.toLocaleString()}`);
  console.log(`5. מתוכם רישומים אחרים: ₪${theoreticalOrUnverifiedInCard.toLocaleString()}`);
  console.log('========================================================================');
}

run();

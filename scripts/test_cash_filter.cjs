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

const VERIFIED_GROW_LEDGER = [
  { ref: '4857277218', amount: 180, month: '2026-09', customerName: 'גל שרה שמש בן יוסף', phone: '0522458841', dogName: 'אוניל' },
  { ref: '173783725', amount: 180, month: '2026-09', customerName: 'נטע הדס', phone: '0526444845', dogName: 'הדס' },
  { ref: '173758692', amount: 180, month: '2026-09', customerName: 'ריקה נברי', phone: '0527777737', dogName: 'ג\'סי הרוטוויילרית' },
  { ref: '514721903', amount: 6300, month: '2026-09', customerName: 'איל שקל', phone: '0505564073', dogName: 'תיאו' },
  { ref: '515223561', amount: 360, month: '2026-09', customerName: 'בני גרין', phone: '0505856800', dogName: 'ספסוף' },
  { ref: '174291549', amount: 540, month: '2026-09', customerName: 'Tali Nisan Avramov', phone: '0508273209', dogName: 'פאבלו' },
  { ref: '516299998', amount: 675, month: '2026-09', customerName: 'דורין לוקס', phone: '0529270115', dogName: 'מגן' },
  { ref: '171099384', amount: 2200, month: '2026-08', customerName: 'אשר ריפמן', phone: '0549420995', dogName: 'ריפמן' },
  { ref: '507419993', amount: 180, month: '2026-08', customerName: 'נאוה גפני', phone: '0545949480', dogName: 'גפני' },
  { ref: '4788806274', amount: 900, month: '2026-08', customerName: 'דינה דיין', phone: '0527204572', dogName: 'דיין' },
  { ref: '507400049', amount: 200, month: '2026-08', customerName: 'תיאן שקל', phone: '0545670355', dogName: 'שקל' },
  { ref: '171140534', amount: 180, month: '2026-08', customerName: 'דליה מוסקוביץ', phone: '0523669361', dogName: 'מוסקוביץ' },
  { ref: '507810263', amount: 1500, month: '2026-08', customerName: 'ירוס ביקאיה', phone: '0556646093', dogName: 'ג\'וי' },
  { ref: '507807309', amount: 1000, month: '2026-08', customerName: 'ירוס ביקאיה', phone: '0556646093', dogName: 'ג\'וי' },
  { ref: '4792995703', amount: 1000, month: '2026-08', customerName: 'ירוס ביקאיה', phone: '0556646093', dogName: 'ג\'וי' },
  { ref: '507806497', amount: 3000, month: '2026-08', customerName: 'ירוס ביקאיה', phone: '0556646093', dogName: 'ג\'וי' },
  { ref: '508467767', amount: 180, month: '2026-08', customerName: 'דוד אלקחר', phone: '0542211442', dogName: 'אלקחר' },
  { ref: '508442380', amount: 540, month: '2026-08', customerName: 'Lior Amir', phone: '0503166129', dogName: 'אמיר' },
  { ref: '508390101', amount: 180, month: '2026-08', customerName: 'זיו זיסו', phone: '0524577752', dogName: 'זיסו' },
  { ref: '508388527', amount: 180, month: '2026-08', customerName: 'זיו זיסו', phone: '0524577752', dogName: 'זיסו' },
  { ref: '508629487', amount: 180, month: '2026-08', customerName: 'מלי סיני', phone: '0507585533', dogName: 'סיני' },
  { ref: '4810894878', amount: 1950, month: '2026-08', customerName: 'עידו שביט', phone: '0546260997', dogName: 'שביט' },
  { ref: '171893936', amount: 1170, month: '2026-08', customerName: 'דליה מוסקוביץ', phone: '0523669361', dogName: 'מוסקוביץ' },
  { ref: '509363691', amount: 2550, month: '2026-08', customerName: 'אור נברי', phone: '0527777787', dogName: 'נברי' },
  { ref: '171863155', amount: 360, month: '2026-08', customerName: 'ירדן וונטש', phone: '0523752473', dogName: 'וונטש' },
  { ref: '509681462', amount: 540, month: '2026-08', customerName: 'יובל אשורי', phone: '0526757615', dogName: 'אשורי' },
  { ref: '4813075012', amount: 1050, month: '2026-08', customerName: 'אלכס בוגטירב', phone: '0507729993', dogName: 'בוגטירב' },
  { ref: '510238566', amount: 300, month: '2026-08', customerName: 'ליקה קובלנקו', phone: '0504858039', dogName: 'קובלנקו' },
  { ref: '510464035', amount: 1770, month: '2026-08', customerName: 'דוד אלקחר', phone: '0542211442', dogName: 'אלקחר' },
  { ref: '510793633', amount: 180, month: '2026-08', customerName: 'עירן אברהם גיל', phone: '0547778221', dogName: 'גיל' },
  { ref: '510777745', amount: 1740, month: '2026-08', customerName: 'זיו זיסו', phone: '0524577752', dogName: 'זיסו' },
  { ref: '510771399', amount: 270, month: '2026-08', customerName: 'אופיר נידרי', phone: '0502244873', dogName: 'נידרי' },
  { ref: '172804032', amount: 540, month: '2026-08', customerName: 'עומר לוטם', phone: '0524399271', dogName: 'לוטם' },
  { ref: '173090500', amount: 1350, month: '2026-08', customerName: 'אלי קובי', phone: '0546160220', dogName: 'ונוס' },
  { ref: '512844224', amount: 180, month: '2026-08', customerName: 'ישראל מנדל', phone: '0505642501', dogName: 'קירה' }
];

const VERIFIED_DIRECT_TRANSFERS = [
  { ref: 'TRANSFER-MILUIM-RONEN-1', amount: 2500, month: '2026-09', customerName: 'רונן מלמוד', phone: '0524673890', dogName: 'רונן מלמוד (קבלה 1)' },
  { ref: 'TRANSFER-MILUIM-RONEN-2', amount: 4000, month: '2026-09', customerName: 'רונן מלמוד', phone: '0524673890', dogName: 'רונן מלמוד (קבלה 2)' }
];

const KNOWN_FUTURE_INSTALLMENTS = [
  { ref: '516299998-INST-2', amount: 675, originalMonth: '2026-09', payoutMonth: '2026-11', customerName: 'דורין לוקס', phone: '0529270115', dogName: 'מגן', installmentNum: 2, totalInstallments: 2 }
];

async function check() {
  const { data: rawBookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error('Error:', error);
    return;
  }
  const bookings = rawBookings.map(b => ({
    id: b.id,
    dogName: b.dog_name || b.data?.dogName,
    ownerName: b.owner_name || b.data?.ownerName,
    ownerPhone: b.owner_phone || b.data?.ownerPhone,
    startDate: b.start_date || b.data?.startDate,
    endDate: b.end_date || b.data?.endDate,
    totalPrice: b.total_price ?? b.data?.totalPrice,
    depositAmount: b.deposit_amount ?? b.data?.depositAmount,
    paymentStatus: b.payment_status || b.data?.paymentStatus,
    stayStatus: b.stay_status || b.data?.stayStatus,
    paymentMethod: b.payment_method || b.data?.paymentMethod,
    refundAmount: b.refund_amount ?? b.data?.refundAmount,
    notes: b.notes || b.data?.notes,
    data: b.data
  }));

  function isGrowPayment(b) {
    const notes = ((b.notes || '') + ' ' + (b.data?.internalNotes || '')).toLowerCase();
    const id = b.id || '';
    const isLedger = VERIFIED_GROW_LEDGER.some(t => notes.includes(t.ref.toLowerCase()) || id.includes(t.ref));
    const isGrowMethod = b.paymentMethod === 'credit' || b.paymentMethod === 'grow';
    const hasGrowKeyword = notes.includes('grow') || notes.includes('אשראי') || notes.includes('סליקה') || notes.includes('gpay');
    const isBank = notes.includes('העברה בנקאית') || (b.ownerName || '').includes('רונן מלמוד');
    return (isLedger || isGrowMethod || hasGrowKeyword) && !isBank;
  }

  function isDirectBankTransfer(b) {
    const notes = ((b.notes || '') + ' ' + (b.data?.internalNotes || '')).toLowerCase();
    const owner = (b.ownerName || '').toLowerCase();
    const isLedger = VERIFIED_DIRECT_TRANSFERS.some(t => owner.includes(t.customerName.toLowerCase()) || (b.id || '').includes(t.ref));
    const isBankMethod = b.paymentMethod === 'bank_transfer';
    const hasBankKeyword = notes.includes('העברה בנקאית') || notes.includes('ישיר לחשבון') || (owner.includes('רונן') && owner.includes('מלמוד'));
    return isLedger || isBankMethod || hasBankKeyword;
  }

  function isInstallmentPayment(b) {
    const notes = ((b.notes || '') + ' ' + (b.data?.internalNotes || '')).toLowerCase();
    const owner = (b.ownerName || '').toLowerCase();
    const dog = (b.dogName || '').toLowerCase();
    const isKnown = KNOWN_FUTURE_INSTALLMENTS.some(inst => owner.includes(inst.customerName.toLowerCase()) || dog.includes(inst.dogName.toLowerCase()));
    const hasInstallmentKeyword = notes.includes('מתוך') || notes.includes('תשלום ראשון') || (owner.includes('דורין') && owner.includes('לוקס'));
    return isKnown || hasInstallmentKeyword;
  }

  function isRefundBooking(b) {
    return (Number(b.refundAmount) || 0) > 0;
  }

  function isCashPayment(b) {
    if (isRefundBooking(b) && (Number(b.depositAmount) || 0) === 0 && b.paymentStatus !== 'fully_paid') {
      return false;
    }
    if (isGrowPayment(b)) return false;
    if (isDirectBankTransfer(b)) return false;
    if (isInstallmentPayment(b)) return false;

    const dog = (b.dogName || '').toLowerCase();
    if (dog.includes("ג'וי") || dog.includes("גו'י")) return false;

    const hasPaid = (Number(b.depositAmount) || 0) > 0 || b.paymentStatus === 'fully_paid';
    if (!hasPaid) return false;

    const notes = ((b.notes || '') + ' ' + (b.data?.internalNotes || '')).toLowerCase();
    return b.paymentMethod === 'cash' || notes.includes('מזומן') || notes.includes('שטרות') || b.paymentMethod === 'bit' || !b.paymentMethod;
  }

  const cashList = bookings.filter(isCashPayment);
  console.log('=== CASH BOOKINGS LIST ===');
  console.log('Total Cash bookings:', cashList.length);
  let totalCash = 0;
  cashList.forEach(b => {
    const amt = b.paymentStatus === 'fully_paid' ? (Number(b.totalPrice) || Number(b.depositAmount)) : Number(b.depositAmount);
    totalCash += amt;
    console.log(`- [${b.id}] כלב: ${b.dogName} | בעלים: ${b.ownerName} (${b.ownerPhone}) | סכום: ₪${amt} | תאריכים: ${b.startDate} עד ${b.endDate} | סטטוס: ${b.paymentStatus}`);
  });
  console.log('Total cash calculated sum: ₪' + totalCash);
}

check();

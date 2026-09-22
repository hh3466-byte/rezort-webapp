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
  { ref: '173758692', amount: 180, month: '2026-09', customerName: 'ריקה נברי', phone: '0527777737', dogName: "ג'סי הרוטוויילרית" },
  { ref: '514721903', amount: 6300, month: '2026-09', customerName: 'איל שקל', phone: '0505564073', dogName: 'תיאו' },
  { ref: '515223561', amount: 360, month: '2026-09', customerName: 'בני גרין', phone: '0505856800', dogName: 'ספסוף' },
  { ref: '174291549', amount: 540, month: '2026-09', customerName: 'Tali Nisan Avramov', phone: '0508273209', dogName: 'פאבלו' },
  { ref: '516299998', amount: 2700, month: '2026-09', customerName: 'דורין לוקס', phone: '0529270115', dogName: 'מגן' },
  { ref: '516703080', amount: 990, month: '2026-09', customerName: 'יניב אלעד', phone: '0545443222', dogName: "ג'נגו" },
  { ref: '4888806968', amount: 108, month: '2026-09', customerName: 'גל שרה שמש בן יוסף', phone: '0522458841', dogName: 'אוניל' },
  { ref: '517029357', amount: 540, month: '2026-09', customerName: 'תם דנינו', phone: '0528023328', dogName: 'מימי רוז' },
  { ref: '517441750', amount: 720, month: '2026-09', customerName: 'יונתן וולפין', phone: '0548037797', dogName: 'זיפו' },
  { ref: '517823870', amount: 1350, month: '2026-09', customerName: 'רעות פויר', phone: '0545495932', dogName: 'טר' },
  { ref: '4900844785', amount: 2000, month: '2026-09', customerName: 'איתי אהרונסון', phone: '0543044647', dogName: 'בוס' },
  { ref: '4906013152', amount: 200, month: '2026-09', customerName: 'שליו ביטון', phone: '0502845556', dogName: 'שליו' },
  { ref: '175543879', amount: 440, month: '2026-09', customerName: 'קארין להב', phone: '0546610321', dogName: 'שון' },
  { ref: '175551443', amount: 2220, month: '2026-09', customerName: 'בוריס ברנר', phone: '0545970156', dogName: 'מייק' },
];

const VERIFIED_DIRECT_TRANSFERS = [
  { ref: 'transfer-ronen-2000', amount: 2000, month: '2026-09', customerName: 'רונן מלמוד', phone: '0524728843', dogName: 'לונה' },
  { ref: 'transfer-ronen-4500', amount: 4500, month: '2026-09', customerName: 'רונן מלמוד', phone: '0524728843', dogName: 'לונה' }
];

const KNOWN_FUTURE_INSTALLMENTS = [
  { ref: '516299998-inst-2', amount: 675, originalMonth: '2026-09', payoutMonth: '2026-11', customerName: 'דורין לוקס', phone: '0529270115', dogName: 'מגן', installmentNum: 2, totalInstallments: 4 },
  { ref: '516299998-inst-3', amount: 675, originalMonth: '2026-09', payoutMonth: '2026-12', customerName: 'דורין לוקס', phone: '0529270115', dogName: 'מגן', installmentNum: 3, totalInstallments: 4 },
  { ref: '516299998-inst-4', amount: 675, originalMonth: '2026-09', payoutMonth: '2027-01', customerName: 'דורין לוקס', phone: '0529270115', dogName: 'מגן', installmentNum: 4, totalInstallments: 4 }
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
    const owner = (b.ownerName || '').toLowerCase();
    const phone = ((b.ownerPhone || '').replace(/\D/g, '')).slice(-7);

    // Direct bank transfer check
    const isBank = notes.includes('העברה בנקאית') || notes.includes('ישיר לחשבון') || owner.includes('רונן מלמוד') || b.paymentMethod === 'bank_transfer';
    if (isBank) return false;

    // Check ledger ref match
    const isLedger = VERIFIED_GROW_LEDGER.some(t => {
      const tRef = t.ref.toLowerCase();
      const tCust = (t.customerName || '').toLowerCase();
      const tDog = (t.dogName || '').toLowerCase();
      const tPhone = (t.phone || '').replace(/\D/g, '').slice(-7);
      return notes.includes(tRef) || id.includes(tRef) || 
        (tPhone && phone && tPhone === phone) ||
        (tCust && owner && (owner.includes(tCust) || tCust.includes(owner))) ||
        (tDog && (b.dogName || '').toLowerCase().includes(tDog));
    });

    const isGrowMethod = b.paymentMethod === 'credit' || b.paymentMethod === 'grow' || b.paymentMethod === 'gpay' || b.paymentMethod === 'grow_bit' || b.paymentMethod === 'link';
    const hasGrowKeyword = notes.includes('grow') || notes.includes('אשראי') || notes.includes('סליקה') || notes.includes('gpay') || notes.includes('לינק') || notes.includes('קישור לתשלום') || notes.includes('bit אשראי') || notes.includes('ב-bit דרך grow');

    // Known Grow customers explicitly
    const isKnownGrowCustomer = 
      owner.includes('יניב') || owner.includes('אלעד') ||
      owner.includes('בוריס') || owner.includes('ברנר') ||
      owner.includes('קארין') || owner.includes('להב') ||
      owner.includes('רעות') || owner.includes('פויר') ||
      owner.includes('דנינו') || owner.includes('תם') ||
      owner.includes('וולפין') || owner.includes('יונתן') ||
      owner.includes('גרין') || owner.includes('בני') ||
      owner.includes('ניסן') || owner.includes('טלי') || owner.includes('tali') ||
      owner.includes('שקל') || owner.includes('איל') || owner.includes('תיאן') ||
      owner.includes('בונדי') || owner.includes('הדס') ||
      owner.includes('נברי') || owner.includes('ניזרי') ||
      owner.includes('קרטה') || owner.includes('נתנאל') ||
      owner.includes('שמש') || owner.includes('גל שרה') ||
      owner.includes('אהרונסון') || owner.includes('איתי') ||
      owner.includes('לוקס') || owner.includes('דורין') ||
      owner.includes('ביטון') || owner.includes('שליו') ||
      owner.includes('מנדל') || owner.includes('ישראל') ||
      owner.includes('ביקאיה') || owner.includes('ירוס');

    return isLedger || isGrowMethod || hasGrowKeyword || isKnownGrowCustomer;
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
    const owner = (b.ownerName || '').toLowerCase();
    if (dog.includes("ג'וי") || dog.includes("גו'י")) return false;
    if (dog.includes("לונה המתגעגעת") || owner.includes("שלומי ממן")) return false;

    const amt = b.paymentStatus === 'fully_paid' 
      ? (Number(b.totalPrice) || Number(b.depositAmount) || 0) 
      : (Number(b.depositAmount) || 0);
    if (amt <= 0) return false;

    const notes = ((b.notes || '') + ' ' + (b.data?.internalNotes || '')).toLowerCase();
    const isExplicitCash = b.paymentMethod === 'cash' || notes.includes('מזומן') || notes.includes('שטרות') || notes.includes('קופה');
    const isKnownCashCustomer = owner.includes('שיין') || owner.includes('מהדי') || owner.includes('פרידנזון') || owner.includes('איילת') || owner.includes('שיגינה') || owner.includes('מרינה');

    return isExplicitCash || isKnownCashCustomer;
  }

  console.log('=============================================');
  console.log('=== 1. GROW / DIGITAL LINK PAYMENTS TAB ===');
  console.log('=============================================');
  const growList = bookings.filter(isGrowPayment);
  growList.forEach(b => {
    const amt = b.paymentStatus === 'fully_paid' ? (Number(b.totalPrice) || Number(b.depositAmount)) : Number(b.depositAmount);
    console.log(`• [${b.id}] ${b.dogName} (${b.ownerName}, ${b.ownerPhone}) | סכום: ₪${amt} | תאריכים: ${b.startDate} עד ${b.endDate} | שיטה: ${b.paymentMethod}`);
  });

  console.log('\n=============================================');
  console.log('=== 2. CASH PAYMENTS TAB (CASH ONLY) ===');
  console.log('=============================================');
  const cashList = bookings.filter(isCashPayment);
  let totalCash = 0;
  cashList.forEach(b => {
    const amt = b.paymentStatus === 'fully_paid' ? (Number(b.totalPrice) || Number(b.depositAmount)) : Number(b.depositAmount);
    totalCash += amt;
    console.log(`• [${b.id}] כלב: ${b.dogName} | בעלים: ${b.ownerName} (${b.ownerPhone}) | סכום: ₪${amt} | תאריכים: ${b.startDate} עד ${b.endDate} | סטטוס: ${b.paymentStatus}`);
  });
  console.log(`Total Verified Cash: ${cashList.length} dogs, Total Sum: ₪${totalCash.toLocaleString()}`);

  console.log('\n=============================================');
  console.log('=== 3. DIRECT BANK TRANSFERS TAB ===');
  console.log('=============================================');
  const bankList = bookings.filter(isDirectBankTransfer);
  bankList.forEach(b => {
    console.log(`• [${b.id}] ${b.dogName} (${b.ownerName}) | סכום: ₪${b.totalPrice || b.depositAmount}`);
  });
}

check();

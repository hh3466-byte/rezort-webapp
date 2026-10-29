const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function testOctCash() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const targetMonthKey = '2026-10';

  let cashCollected = 0;
  bookings.forEach(b => {
    const d = b.data || {};
    const stayStatus = b.stay_status || b.stayStatus || d.stayStatus;
    const paymentStatus = b.payment_status || b.paymentStatus || d.paymentStatus;
    const totalPrice = Number(b.total_price ?? b.totalPrice ?? d.totalPrice ?? 0);
    const depAmount = Number(b.deposit_amount ?? b.depositAmount ?? d.depositAmount ?? 0);
    const dogName = b.dog_name || b.dogName || d.dogName || '';

    if (stayStatus === 'cancelled' || paymentStatus === 'unpaid' || totalPrice <= 0 || b.isFreeStay || (b.data && b.data.isFreeStay)) {
      return;
    }
    if (dogName.includes("ג'וי") || dogName.includes("גו'י")) return;

    const ownerName = (b.owner_name || b.ownerName || d.ownerName || '').toLowerCase();
    const notes = (((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).trim()).toLowerCase();
    const payMethod = String(b.payment_method || b.paymentMethod || d.paymentMethod || '').toLowerCase();

    const isDirectBank = (ownerName.includes('רונן') && ownerName.includes('מלמוד')) || 
      ownerName.includes('פרידנזון') || 
      payMethod === 'bank_transfer' ||
      notes.includes('העברה בנקאית') || 
      notes.includes('ישיר לחשבון') || 
      notes.includes('העברות ישירות');
    if (isDirectBank) return;

    const isGrowMethod = payMethod === 'credit' || payMethod === 'grow' || payMethod === 'gpay' || payMethod === 'grow_bit' || payMethod === 'link' || payMethod === 'bit';
    const hasGrowKeyword = notes.includes('grow') || notes.includes('אשראי') || notes.includes('סליקה') || notes.includes('gpay') || notes.includes('applepay') || notes.includes('אסמכתא') || notes.includes('קישור לתשלום') || notes.includes('bit אשראי') || notes.includes('ב-bit דרך grow');

    if (isGrowMethod || hasGrowKeyword) return;

    const start = b.start_date || b.startDate || d.startDate || '';
    const end = b.end_date || b.endDate || d.endDate || '';

    if (start > `${targetMonthKey}-31`) return;
    const isInMonth = start.startsWith(targetMonthKey) || end.startsWith(targetMonthKey);
    if (!isInMonth) return;

    const cleanNotesForCash = notes
      .replace(/הטבת מזומן מיידית/g, '')
      .replace(/הטבת מזומן/g, '');

    const isExplicitCash = payMethod === 'cash' || cleanNotesForCash.includes('מזומן') || cleanNotesForCash.includes('שטרות') || cleanNotesForCash.includes('קופה');
    const isKnownCashCustomer = ownerName.includes('שיין') || ownerName.includes('מהדי') || ownerName.includes('שיגינה') || ownerName.includes('מרינה');

    if (isExplicitCash || isKnownCashCustomer) {
      const createdMonth = (b.createdAt || d.createdAt || b.created_at || '').substring(0, 7);
      if (createdMonth && createdMonth < targetMonthKey && paymentStatus === 'fully_paid') {
        return;
      }
      const amt = paymentStatus === 'fully_paid' ? totalPrice : depAmount;
      if (amt > 0) {
        cashCollected += amt;
        console.log(`Cash counted: ${amt} for ${ownerName}`);
      }
    }
  });

  console.log(`October 2026 Cash Total: ₪${cashCollected}`);
}

testOctCash();

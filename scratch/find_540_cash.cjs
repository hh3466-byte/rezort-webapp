const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function find540() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: grow } = await supabase.from('grow_incoming_payments').select('*');

  console.log('--- ALL BOOKINGS WITH 540 ---');
  bookings.forEach(b => {
    const tot = b.total_price || b.totalPrice || 0;
    const dep = b.deposit_amount || b.depositAmount || 0;
    if (tot === 540 || dep === 540) {
      console.log('Booking 540:', b.id, b.owner_name || b.ownerName, b.dog_name || b.dogName, `${b.start_date || b.startDate} -> ${b.end_date || b.endDate}`, `tot=${tot}, dep=${dep}`, `method=${b.payment_method || b.paymentMethod}`, `status=${b.payment_status || b.paymentStatus}`, `notes=${b.notes}`);
    }
  });

  // Run dateUtils cashCollected logic exactly as in dateUtils.ts for October 2026 ('2026-10')
  console.log('\n--- SIMULATING OCT 2026 CASH COLLECTED ---');
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
    const phone = ((b.owner_phone || b.ownerPhone || d.ownerPhone || '').replace(/\D/g, '')).slice(-7);
    const notes = (((b.notes || d.notes || '') + ' ' + (d.internalNotes || '')).trim()).toLowerCase();
    const payMethod = String(b.payment_method || b.paymentMethod || d.paymentMethod || '').toLowerCase();

    const isDirectBank = (ownerName.includes('רונן') && ownerName.includes('מלמוד')) || 
      ownerName.includes('פרידנזון') || 
      payMethod === 'bank_transfer' ||
      notes.includes('העברה בנקאית') || 
      notes.includes('ישיר לחשבון') || 
      notes.includes('העברות ישירות');
    if (isDirectBank) return;

    const isGrowMethod = payMethod === 'credit' || payMethod === 'grow' || payMethod === 'gpay' || payMethod === 'grow_bit' || payMethod === 'link';
    const hasGrowKeyword = notes.includes('grow') || notes.includes('אשראי') || notes.includes('סליקה') || notes.includes('gpay') || notes.includes('applepay') || notes.includes('אסמכתא') || notes.includes('קישור לתשלום') || notes.includes('bit אשראי') || notes.includes('ב-bit דרך grow');

    const isKnownGrowCustomer = 
      ownerName.includes('יניב') || ownerName.includes('אלעד') ||
      ownerName.includes('בוריס') || ownerName.includes('ברנר') ||
      ownerName.includes('קארין') || ownerName.includes('להב') ||
      ownerName.includes('רעות') || ownerName.includes('פויר') ||
      ownerName.includes('דנינו') || ownerName.includes('תם') ||
      ownerName.includes('וולפין') || ownerName.includes('יונתן') ||
      ownerName.includes('גרין') || ownerName.includes('בני') ||
      ownerName.includes('ניסן') || ownerName.includes('טלי') || ownerName.includes('tali') ||
      ownerName.includes('שקל') || ownerName.includes('איל') || ownerName.includes('תיאן') ||
      ownerName.includes('בונדי') || ownerName.includes('הדס') ||
      ownerName.includes('נברי') || ownerName.includes('ניזרי') ||
      ownerName.includes('קרטה') || ownerName.includes('נתנאל') ||
      ownerName.includes('שמש') || ownerName.includes('גל שרה') ||
      ownerName.includes('אהרונסון') || ownerName.includes('איתי') ||
      ownerName.includes('לוקס') || ownerName.includes('דורין') ||
      ownerName.includes('ביטון') || ownerName.includes('שליו') ||
      ownerName.includes('מנדל') || ownerName.includes('ישראל') ||
      ownerName.includes('מיכאל') || ownerName.includes('בן הר') ||
      ownerName.includes('ישי אמון') || ownerName.includes('אמון') ||
      ownerName.includes('דלויה');

    if (isGrowMethod || hasGrowKeyword || isKnownGrowCustomer) return;

    const start = b.start_date || b.startDate || d.startDate || '';
    const end = b.end_date || b.endDate || d.endDate || '';

    if (start > '2026-10-31') return;
    const isInMonth = start.startsWith('2026-10') || end.startsWith('2026-10');
    if (!isInMonth) return;

    const cleanNotesForCash = notes
      .replace(/הטבת מזומן מיידית/g, '')
      .replace(/הטבת מזומן/g, '');

    const isExplicitCash = payMethod === 'cash' || cleanNotesForCash.includes('מזומן') || cleanNotesForCash.includes('שטרות') || cleanNotesForCash.includes('קופה');
    const isKnownCashCustomer = ownerName.includes('שיין') || ownerName.includes('מהדי') || ownerName.includes('שיגינה') || ownerName.includes('מרינה');

    if (isExplicitCash || isKnownCashCustomer) {
      const amt = paymentStatus === 'fully_paid' ? totalPrice : depAmount;
      if (amt > 0) {
        cashCollected += amt;
        console.log(`-> Counted in OCT cashCollected: ${amt} for ${ownerName} (${dogName}) [dates: ${start}..${end}, notes: ${notes}]`);
      }
    }
  });
  console.log(`Total OCT cashCollected: ₪${cashCollected}`);
}

find540();

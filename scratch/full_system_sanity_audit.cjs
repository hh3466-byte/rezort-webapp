const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

function isValidPhone(p) {
  const c = cleanPhoneNumber(p);
  return /^05\d{8}$/.test(c) || /^0[23489]\d{7}$/.test(c);
}

async function audit() {
  const today = '2026-10-16';
  console.log(`=== FULL SYSTEM SANITY AUDIT (${today}) ===\n`);

  // 1. Fetch Bookings
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  if (bErr) throw bErr;
  console.log(`Total Bookings in DB: ${bookings.length}`);

  // 2. Fetch Settings (Intakes, etc.)
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0] || {};
  const intakeForms = s.intake_forms || [];

  // 3. Fetch Intake Requests
  const { data: intakeRequests } = await supabase.from('intake_requests').select('*');

  // 4. Fetch Grow Payments
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  // Filter Active & Future Bookings
  const activeAndFuture = bookings.filter(b => {
    const end = b.end_date || b.endDate || '';
    const status = b.stay_status || b.stayStatus || '';
    return end >= today && status !== 'cancelled' && status !== 'checked_out' && status !== 'archived';
  });
  console.log(`Active & Future Bookings (endDate >= ${today}): ${activeAndFuture.length}\n`);

  const greenList = [];
  const redLights = {
    zeroDeposit: [],
    unpaidStay: [],
    invalidPhone: [],
    dateIssues: [],
    partnerDuplicates: [],
    paymentDiscrepancies: [],
    unhandledIntakes: [],
    bogusGrowRecords: []
  };

  // Audit Bookings
  activeAndFuture.forEach(b => {
    const id = b.id;
    const owner = (b.owner_name || b.ownerName || '').trim();
    const dog = (b.dog_name || b.dogName || '').trim();
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate || '';
    const end = b.end_date || b.endDate || '';
    const total = Number(b.total_price ?? b.totalPrice ?? 0);
    const deposit = Number(b.deposit_amount ?? b.depositAmount ?? 0);
    const payStatus = b.payment_status || b.paymentStatus || 'unpaid';
    const isFree = b.is_free_stay || b.isFreeStay || false;
    const notes = (b.notes || '') + ' ' + (b.data?.notes || '');
    const cleanP = cleanPhoneNumber(phone);

    let hasIssue = false;

    // Check phone
    if (!isValidPhone(phone)) {
      redLights.invalidPhone.push(`הזמנה ${id}: ${dog} (${owner}) - טלפון לא תקין (${phone})`);
      hasIssue = true;
    }

    // Check dates
    if (!start || !end || start > end) {
      redLights.dateIssues.push(`הזמנה ${id}: ${dog} (${owner}) - תאריכים שגויים (${start} עד ${end})`);
      hasIssue = true;
    }

    // Check zero deposit on future bookings
    const isPairDog = notes.includes('זוג') || notes.includes('שולם דרך') || notes.includes('כלב שני') || notes.includes('כלב נוסף');
    if (start > today) {
      // Future booking
      if (deposit === 0 && !isFree && !isPairDog) {
        redLights.zeroDeposit.push(`הזמנה עתידית ללא מקדמה (₪0): ${dog} (${owner}), תאריכים: ${start}..${end}, סה"כ לתשלום: ₪${total}`);
        hasIssue = true;
      }
    }

    // Check active stay payment status
    if (start <= today && end >= today) {
      // Currently staying
      if (payStatus === 'unpaid' && deposit === 0 && !isFree && !isPairDog) {
        redLights.unpaidStay.push(`כלב שוהה כרגע ללא תשלום/מקדמה: ${dog} (${owner}), תאריכים: ${start}..${end}, סה"כ: ₪${total}`);
        hasIssue = true;
      }
    }

    // Check financial mismatch: deposit > total
    if (deposit > total && total > 0) {
      redLights.paymentDiscrepancies.push(`מקדמה חורגת מסה"כ: ${dog} (${owner}), מקדמה ₪${deposit} > סה"כ ₪${total}`);
      hasIssue = true;
    }

    if (!hasIssue) {
      greenList.push(`${dog} (${owner}) - ${start}..${end} | ₪${deposit}/${total} (${payStatus})`);
    }
  });

  // Audit Intake Requests
  (intakeRequests || []).forEach(req => {
    const start = req.start_date || req.startDate || '';
    const end = req.end_date || req.endDate || '';
    const status = req.status || '';
    if (end >= today && (status === 'pending' || status === 'in_review' || status === 'payment_sent')) {
      redLights.unhandledIntakes.push(`שאלון קליטה פעיל בסטטוס '${status}': ${req.dog_name || req.dogName} (${req.owner_name || req.ownerName}), טלפון: ${req.owner_phone || req.ownerPhone}, תאריכים: ${start}..${end}`);
    }
  });

  // Audit Bogus Grow Payments
  (growPayments || []).forEach(p => {
    if (p.id === 'grow_176637167' || p.id === 'grow_554341') {
      redLights.bogusGrowRecords.push(`רשומת רפאים בטבלת Grow: מזהה ${p.id}, לקוח: ${p.customer_name}, סכום: ₪${p.amount}`);
    }
  });

  console.log('=== AUDIT RESULTS ===');
  console.log(`🟢 תקינים (אירועים ירוקים): ${greenList.length}`);
  console.log(`🚨 אורות אדומים סה"כ: ${
    redLights.zeroDeposit.length + 
    redLights.unpaidStay.length + 
    redLights.invalidPhone.length + 
    redLights.dateIssues.length + 
    redLights.paymentDiscrepancies.length + 
    redLights.unhandledIntakes.length + 
    redLights.bogusGrowRecords.length
  }\n`);

  console.log('--- פירוט אורות אדומים ---');
  for (const [category, items] of Object.entries(redLights)) {
    if (items.length > 0) {
      console.log(`\n🔻 ${category} (${items.length}):`);
      items.forEach(it => console.log(`  • ${it}`));
    }
  }

  console.log('\n--- דוגמאות לאירועים ירוקים (5 ראשונים) ---');
  greenList.slice(0, 5).forEach(it => console.log(`  ✓ ${it}`));
}

audit().catch(console.error);

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').trim().replace(/^['"]|['"]$/g, '');
});

const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: growPayments } = await s.from('grow_incoming_payments').select('*');

  const KNOWN_FUTURE_INSTALLMENTS = [
    { ref: '516299998-inst-2', customerName: 'דורין לוקס', dogName: 'מגן', originalMonth: '2026-09', installmentNum: 2, totalInstallments: 4, payoutDate: '2026-11-10', payoutMonth: '2026-11', amount: 675 },
    { ref: '516299998-inst-3', customerName: 'דורין לוקס', dogName: 'מגן', originalMonth: '2026-09', installmentNum: 3, totalInstallments: 4, payoutDate: '2026-12-10', payoutMonth: '2026-12', amount: 675 },
    { ref: '516299998-inst-4', customerName: 'דורין לוקס', dogName: 'מגן', originalMonth: '2026-09', installmentNum: 4, totalInstallments: 4, payoutDate: '2027-01-10', payoutMonth: '2027-01', amount: 675 },
    { ref: '4961553619-inst-2', customerName: 'לי דלויה', dogName: 'ליאו', originalMonth: '2026-10', installmentNum: 2, totalInstallments: 2, payoutDate: '2026-12-10', payoutMonth: '2026-12', amount: 2000 },
  ];

  const targetMonthKey = '2026-10';
  const processedRefs = new Set();
  let growClearedBankOn10th = 0;

  // 1. Ledger
  const VERIFIED_GROW_LEDGER = [
    { ref: '4936821879', amount: 4300, date: '2026-10-02', month: '2026-10', customerName: 'איתי אהרונסון', dogName: 'בוס' }
  ];
  VERIFIED_GROW_LEDGER.forEach(t => {
    if (t.month === targetMonthKey) {
      growClearedBankOn10th += t.amount;
      processedRefs.add(t.ref);
    }
  });

  // 2. Incoming grow
  growPayments.forEach(p => {
    const ref = String(p.reference_id || p.id || '');
    const custName = p.customer_name || '';
    if (ref && !processedRefs.has(ref)) {
      const pMonth = (p.created_at || '').substring(0, 7);
      if (pMonth === targetMonthKey && p.status !== 'dismissed' && p.status !== 'refunded') {
        const isDupWebhook = (p.raw_email_snippet || '').includes('Grow Webhook') && growPayments.some(other => 
          other.id !== p.id && 
          other.status !== 'dismissed' &&
          !(other.raw_email_snippet || '').includes('Grow Webhook') &&
          other.customer_name === p.customer_name &&
          Number(other.amount) === Number(p.amount) &&
          (other.created_at || '').substring(0, 10) === (p.created_at || '').substring(0, 10)
        );
        if (isDupWebhook) {
          console.log('Skipping duplicate webhook:', p.id, p.customer_name, p.amount);
          return;
        }

        const totalAmt = Number(p.amount) || 0;
        // Match future installment strictly by transaction reference ID
        const futureInsts = KNOWN_FUTURE_INSTALLMENTS.filter(inst => 
          inst.originalMonth === targetMonthKey && inst.ref.startsWith(ref)
        );
        const futureAmt = futureInsts.reduce((sum, inst) => sum + inst.amount, 0);
        const currentPayoutAmt = Math.max(0, totalAmt - futureAmt);
        
        console.log(`Adding ${p.customer_name} (${ref}): total ₪${totalAmt}, deferred ₪${futureAmt} -> current payout on 10.11: ₪${currentPayoutAmt}`);
        growClearedBankOn10th += currentPayoutAmt;
        processedRefs.add(ref);
      }
    }
  });

  // In two months:
  const inTwoMonthsKey = '2026-12';
  let bankOn10thInTwoMonths = 0;
  KNOWN_FUTURE_INSTALLMENTS.forEach(inst => {
    if (inst.payoutMonth === inTwoMonthsKey || (inst.originalMonth === targetMonthKey && inst.installmentNum === 2)) {
      bankOn10thInTwoMonths += inst.amount;
    }
  });

  console.log('----------------------------------------------------');
  console.log('Box 2 (ייכנס ב-10.11 GROW):', growClearedBankOn10th);
  console.log('Box 4 (ייכנס ב-10.12 תשלומים):', bankOn10thInTwoMonths);
}

main().catch(console.error);

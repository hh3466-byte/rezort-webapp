const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function syncZeroDebt() {
  console.log('--- Setting zero debt baseline for Hila the Trainer ---');

  // 1. Update settings with receipt 20056 as fully paid
  const { data: settingsArr } = await supabase.from('settings').select('*');
  if (settingsArr && settingsArr.length > 0) {
    const s = settingsArr[0];
    const curData = s.data || {};
    const updatedReceipts = [
      {
        id: 'receipt-20056',
        receiptNumber: '20056',
        receiptDate: '2026-09-14',
        totalAmount: 1000,
        paymentMethod: 'ביט',
        rawLineText: 'גוי תשלום 2/3 + תיאן תשלום 1/3',
        receiptImageUrl: '',
        allocations: [
          {
            bookingId: 'b-1789657778767',
            dogName: "גו'י",
            stage: '2/3',
            amount: 500,
          },
          {
            bookingId: 'b-1788685190273',
            dogName: 'תיאו',
            stage: '1/3',
            amount: 500,
          },
        ],
        isPaidActually: true, // שולם הכל במלואו בביט
        paidDate: '2026-09-14',
        paymentConfirmationNotes: 'שולם במלואו בביט להילה - אין חובות פתוחים',
        managerQuerySent: true,
        managerQuerySentAt: '2026-09-14T10:00:00Z',
        status: 'paid',
        createdAt: '2026-09-14T09:00:00Z',
        updatedAt: new Date().toISOString(),
      }
    ];

    const { error: setErr } = await supabase.from('settings').update({
      data: {
        ...curData,
        trainerReceipts: updatedReceipts,
        trainerBalanceStatus: 'all_paid_zero_debt',
        trainerLastSettledAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }).eq('id', s.id);

    console.log('Settings trainerReceipts updated:', setErr ? setErr.message : 'OK');
  }

  // 2. Update training bookings stages
  // Joy (b-1789657778767): stages 1/3 and 2/3 paid
  const joyStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      isPaidActually: true,
      paidDate: '2026-08-20',
      receiptNumber: '20050',
      paymentMethod: 'bit',
      notes: 'שולם בביט להילה',
      updatedAt: new Date().toISOString(),
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע)',
      amount: 500,
      isPaidActually: true,
      paidDate: '2026-09-14',
      receiptNumber: '20056',
      paymentMethod: 'bit',
      notes: 'שולם בביט להילה (קבלה 20056)',
      updatedAt: new Date().toISOString(),
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סוף תשלום)',
      amount: 500,
      isPaidActually: false,
      updatedAt: new Date().toISOString(),
    },
  ];

  await supabase.from('bookings').update({
    trainer_stages: joyStages,
    data: {
      trainerStages: joyStages
    },
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1789657778767');
  console.log('Updated Joy stages: 1/3 and 2/3 paid (₪1,000 paid)');

  // Theo (b-1788685190273): stage 1/3 paid (קבלה 20056)
  const theoStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      isPaidActually: true,
      paidDate: '2026-09-14',
      receiptNumber: '20056',
      paymentMethod: 'bit',
      notes: 'שולם בביט להילה (קבלה 20056)',
      updatedAt: new Date().toISOString(),
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע)',
      amount: 500,
      isPaidActually: false,
      updatedAt: new Date().toISOString(),
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סוף תשלום)',
      amount: 500,
      isPaidActually: false,
      updatedAt: new Date().toISOString(),
    },
  ];

  await supabase.from('bookings').update({
    trainer_stages: theoStages,
    data: {
      trainerStages: theoStages
    },
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1788685190273');
  console.log('Updated Theo stages: 1/3 paid (₪500 paid)');

  console.log('✅ Baseline sync completed: 0 open debts to Hila.');
}

syncZeroDebt();

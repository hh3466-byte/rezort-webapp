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

async function intakeLunaReceipt() {
  console.log('--- Registering Receipt 20057 for Luna (500 NIS) ---');

  const lunaReceipt = {
    id: 'receipt-20057',
    receiptNumber: '20057',
    receiptDate: '2026-09-22',
    totalAmount: 500,
    paymentMethod: 'ביט',
    rawLineText: 'אילוף לונה (לא של שלומי) תשלום 1/3',
    receiptImageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/428e6e1b-116f-4d95-b4bc-1aa59a83f549.jpg',
    allocations: [
      {
        bookingId: 'b-1789541492653',
        dogName: 'לונה',
        stage: '1/3',
        amount: 500,
      }
    ],
    isPaidActually: false, // ממתין לתשלום בביט משמוליק / או אם שולם
    status: 'pending_payment',
    managerQuerySent: true,
    managerQuerySentAt: '2026-09-22T07:52:43Z',
    createdAt: '2026-09-22T07:52:43Z',
    updatedAt: new Date().toISOString()
  };

  // 1. Update settings trainerReceipts
  const { data: settingsArr } = await supabase.from('settings').select('*');
  if (settingsArr && settingsArr.length > 0) {
    const s = settingsArr[0];
    const curData = s.data || {};
    const curReceipts = Array.isArray(curData.trainerReceipts) ? curData.trainerReceipts : [];
    
    // Add or update 20057
    const updatedReceipts = [
      lunaReceipt,
      ...curReceipts.filter(r => r.id !== 'receipt-20057' && r.receiptNumber !== '20057')
    ];

    await supabase.from('settings').update({
      data: {
        ...curData,
        trainerReceipts: updatedReceipts
      },
      updated_at: new Date().toISOString()
    }).eq('id', s.id);
    console.log('Saved receipt 20057 to Supabase settings.');
  }

  // 2. Update Luna booking trainer_stages
  const lunaStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      isPaidActually: false, // ממתין לתשלום
      receiptNumber: '20057',
      receiptDate: '2026-09-22',
      receiptImageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/428e6e1b-116f-4d95-b4bc-1aa59a83f549.jpg',
      paymentMethod: 'bit',
      notes: 'אילוף לונה (לא של שלומי) תשלום 1/3 - קבלה 20057',
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
    trainer_stages: lunaStages,
    data: {
      trainerStages: lunaStages
    },
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1789541492653');

  console.log('Updated Luna booking with receipt 20057.');
}

intakeLunaReceipt();

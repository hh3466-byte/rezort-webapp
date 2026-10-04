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

async function run() {
  console.log('--- Updating All Training Bookings in Supabase ---');

  // 1. לונה המתגעגעת (שלומי ממן) - שולם ישירות ע"י שלומי להילה! 0 הוצאה לריזורט ו-0 חוב.
  const shlomiLunaStages = [
    { stage: '1/3', label: 'תשלום 1/3 (שולם ישירות ע״י שלומי להילה)', amount: 0, isPaidActually: true, paidDate: '2026-05-01', notes: 'שולם ישירות ע״י הבעלים' },
    { stage: '2/3', label: 'תשלום 2/3 (שולם ישירות ע״י שלומי להילה)', amount: 0, isPaidActually: true, paidDate: '2026-05-01', notes: 'שולם ישירות ע״י הבעלים' },
    { stage: '3/3', label: 'תשלום 3/3 (שולם ישירות ע״י שלומי להילה)', amount: 0, isPaidActually: true, paidDate: '2026-05-01', notes: 'שולם ישירות ע״י הבעלים' },
  ];

  const { data: bShlomi } = await supabase.from('bookings').select('*').eq('id', 'b-1789361510508').single();
  if (bShlomi) {
    const updatedData = {
      ...bShlomi.data,
      trainerPaid: 0,
      trainerDebt: 0,
      isTrainingCompleted: true,
      trainingCompletedAt: '2026-05-01',
      trainerStages: shlomiLunaStages,
      notes: 'אילוף פנסיון - שולם ישירות ע״י שלומי להילה (ללא חוב וללא הוצאה לריזורט)'
    };
    await supabase.from('bookings').update({
      data: updatedData,
      notes: 'אילוף פנסיון - שולם ישירות ע״י שלומי להילה (ללא חוב וללא הוצאה לריזורט)'
    }).eq('id', 'b-1789361510508');
    console.log('✓ לונה של שלומי עודכנה בהצלחה (0 חוב ו-0 הוצאה)');
  }

  // 2. ג'וי (ירוס ביקאיה - b-1789657778767)
  const joyStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      receiptNumber: '20050',
      receiptDate: '2026-08-16',
      isPaidActually: true,
      paidDate: '2026-08-16',
      paymentMethod: 'bank_transfer',
      notes: 'העברה בנקאית ₪500 (קבלה 20050)'
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע)',
      amount: 500,
      receiptNumber: '20056',
      receiptDate: '2026-09-14',
      isPaidActually: true,
      paidDate: '2026-09-14',
      paymentMethod: 'bit',
      notes: 'תשלום ביט ₪500 (קבלה 20056)'
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סיום - נשאר)',
      amount: 500,
      isPaidActually: false
    }
  ];

  const { data: bJoy } = await supabase.from('bookings').select('*').eq('id', 'b-1789657778767').single();
  if (bJoy) {
    const updatedData = {
      ...bJoy.data,
      trainerPaid: 1000,
      trainerDebt: 500,
      isTrainingCompleted: false,
      trainerStages: joyStages
    };
    await supabase.from('bookings').update({ data: updatedData }).eq('id', 'b-1789657778767');
    console.log('✓ ג\'וי עודכנה (שולם ₪1,000 קבלות 20050+20056, נשאר ₪500)');
  }

  // 3. תיאו (איל שקל - b-1788685190273)
  const theoStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      receiptNumber: '20056',
      receiptDate: '2026-09-14',
      isPaidActually: true,
      paidDate: '2026-09-14',
      paymentMethod: 'bit',
      notes: 'שולם בביט (קבלה 20056)'
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע)',
      amount: 500,
      receiptNumber: '20061',
      receiptDate: '2026-10-04',
      isPaidActually: true,
      paidDate: '2026-10-04',
      paymentMethod: 'bit',
      bitConfirmationNumber: '1078-8325-73347',
      notes: 'שולם בביט (קבלה 20061, אישור 1078-8325-73347)'
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סיום - נשאר)',
      amount: 500,
      isPaidActually: false
    }
  ];

  const { data: bTheo } = await supabase.from('bookings').select('*').eq('id', 'b-1788685190273').single();
  if (bTheo) {
    const updatedData = {
      ...bTheo.data,
      trainerPaid: 1000,
      trainerDebt: 500,
      isTrainingCompleted: false,
      trainerStages: theoStages
    };
    await supabase.from('bookings').update({ data: updatedData }).eq('id', 'b-1788685190273');
    console.log('✓ תיאו עודכן (שולם ₪1,000 קבלות 20056+20061, נשאר ₪500)');
  }

  // 4. לונה רונן מלמוד (b-1789541492653)
  const lunaStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      receiptNumber: '20057',
      receiptDate: '2026-09-22',
      isPaidActually: true,
      paidDate: '2026-09-22',
      paymentMethod: 'bit',
      bitConfirmationNumber: '1378-7978-59402',
      notes: 'שולם בביט (קבלה 20057, אישור 1378-7978-59402)'
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע - נשאר)',
      amount: 500,
      isPaidActually: false
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סיום - נשאר)',
      amount: 500,
      isPaidActually: false
    }
  ];

  const { data: bLuna } = await supabase.from('bookings').select('*').eq('id', 'b-1789541492653').single();
  if (bLuna) {
    const updatedData = {
      ...bLuna.data,
      trainerPaid: 500,
      trainerDebt: 1000,
      isTrainingCompleted: false,
      trainerStages: lunaStages
    };
    await supabase.from('bookings').update({ data: updatedData }).eq('id', 'b-1789541492653');
    console.log('✓ לונה (רונן מלמוד) עודכנה (שולם ₪500 קבלה 20057, נשאר ₪1,000)');
  }

  // 5. בוס (איתי אהרונסון - b-1789732108163)
  const bossStages = [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      receiptNumber: '20061',
      receiptDate: '2026-10-04',
      isPaidActually: true,
      paidDate: '2026-10-04',
      paymentMethod: 'bit',
      bitConfirmationNumber: '1078-8325-73347',
      notes: 'שולם בביט (קבלה 20061, אישור 1078-8325-73347)'
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע - נשאר)',
      amount: 500,
      isPaidActually: false
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סיום - נשאר)',
      amount: 500,
      isPaidActually: false
    }
  ];

  const { data: bBoss } = await supabase.from('bookings').select('*').eq('id', 'b-1789732108163').single();
  if (bBoss) {
    const updatedData = {
      ...bBoss.data,
      trainerPaid: 500,
      trainerDebt: 1000,
      isTrainingCompleted: false,
      trainerStages: bossStages
    };
    await supabase.from('bookings').update({ data: updatedData }).eq('id', 'b-1789732108163');
    console.log('✓ בוס (איתי אהרונסון) עודכן (שולם ₪500 קבלה 20061, נשאר ₪1,000)');
  }

  console.log('\n--- All Training Dogs and Receipts Synchronized in Database Successfully! ---');
}

run().catch(console.error);

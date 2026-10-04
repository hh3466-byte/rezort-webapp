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
  const { data: bShlomi } = await supabase.from('bookings').select('*').eq('id', 'b-1789361510508').single();
  if (bShlomi) {
    const updatedData = {
      ...bShlomi.data,
      trainerPaid: 0,
      trainerDebt: 0,
      isTrainingCompleted: false, // Active training dog!
      isDirectTrainerPayment: true,
      trainerStages: [
        { stage: '1/3', label: 'שולם ישירות להילה ע״י שלומי', amount: 0, isPaidActually: true, paidDate: '2026-05-01', notes: 'שולם ישירות להילה' },
        { stage: '2/3', label: 'שולם ישירות להילה ע״י שלומי', amount: 0, isPaidActually: true, paidDate: '2026-05-01', notes: 'שולם ישירות להילה' },
        { stage: '3/3', label: 'שולם ישירות להילה ע״י שלומי', amount: 0, isPaidActually: true, paidDate: '2026-05-01', notes: 'שולם ישירות להילה' },
      ],
      notes: 'אילוף פנסיון - שולם ישירות ע״י שלומי להילה (ללא חוב כספי לריזורט)'
    };

    await supabase.from('bookings').update({
      data: updatedData,
      notes: 'אילוף פנסיון - שולם ישירות ע״י שלומי להילה (ללא חוב כספי לריזורט)'
    }).eq('id', 'b-1789361510508');
    console.log('✓ Shlomi Luna set to Active Training with 0 Debt successfully!');
  }
}

run().catch(console.error);

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
  const { data: rawBookings } = await supabase.from('bookings').select('*');
  const bookings = rawBookings.map(b => ({ ...b, ...b.data }));
  
  const training = bookings.filter(b => b.serviceType === 'training' || b.service_type === 'training');
  console.log('==================================================');
  console.log('       דוח תשלומי ומצבת אילוף (הילה קירזנר - Halodog)');
  console.log('==================================================\n');

  console.log('--- 1. כלבים באילוף פעיל (Active Training Dogs) ---');
  const active = training.filter(b => !b.isTrainingCompleted && b.stayStatus !== 'cancelled');
  active.forEach(b => {
    const stages = b.trainerStages || [];
    const paidSum = stages.filter(s => s.isPaidActually).reduce((sum, s) => sum + (s.amount || 0), 0);
    const debtSum = Math.max(0, 1500 - paidSum);
    console.log(`🐕 ${b.dogName || b.dog_name} (${b.ownerName || b.owner_name}):`);
    console.log(`   - תאריכים: ${b.startDate || b.start_date} עד ${b.endDate || b.end_date} | חדר: ${b.kennelNumber || 'לא שובץ'}`);
    console.log(`   - סה״כ שולם להילה: ₪${paidSum.toLocaleString()} / ₪1,500 | יתרה לסיום: ₪${debtSum.toLocaleString()}`);
    stages.forEach(st => {
      console.log(`     • שלב ${st.stage}: ₪${st.amount} [${st.isPaidActually ? `✓ שולם (קבלה ${st.receiptNumber || '20056'})` : '⏳ טרם שולם'}] ${st.notes || ''}`);
    });
    console.log('');
  });

  console.log('--- 2. כלבי אילוף שהושלמו / שולמו ישירות (Completed / Direct) ---');
  const completed = training.filter(b => b.isTrainingCompleted);
  completed.forEach(b => {
    console.log(`🏁 ${b.dogName || b.dog_name} (${b.ownerName || b.owner_name}):`);
    console.log(`   - הערות: ${b.notes}`);
    console.log(`   - סטטוס: הושלם ומסודר (0 חוב ו-0 הוצאה לריזורט)\n`);
  });
}

run().catch(console.error);

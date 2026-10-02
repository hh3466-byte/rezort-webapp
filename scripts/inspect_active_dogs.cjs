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

async function inspectActiveDogs() {
  const { data: bList } = await supabase.from('bookings').select('*');
  const today = '2026-10-02';
  const active = (bList || []).filter(b => {
    const d = b.data || {};
    const start = b.start_date || d.startDate;
    const end = b.end_date || d.endDate;
    const status = b.stay_status || d.stayStatus;
    return status !== 'cancelled' && end >= '2026-09-30';
  });

  console.log(`Active / recent dogs around ${today}: ${active.length}\n`);
  active.forEach(b => {
    const d = b.data || {};
    console.log({
      id: b.id,
      dogName: b.dog_name || d.dogName,
      ownerName: b.owner_name || d.ownerName,
      dates: `${b.start_date || d.startDate} -> ${b.end_date || d.endDate}`,
      stayStatus: b.stay_status || d.stayStatus,
      kennelNumber: d.kennelNumber,
      totalPrice: b.total_price || d.totalPrice,
      depositAmount: b.deposit_amount || d.depositAmount,
      paymentStatus: b.payment_status || d.paymentStatus,
      notes: b.notes || d.notes
    });
  });
}

inspectActiveDogs().catch(console.error);

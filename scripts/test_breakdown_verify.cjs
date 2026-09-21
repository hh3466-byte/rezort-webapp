const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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

async function testBreakdown() {
  const { data: bRows } = await supabase.from('bookings').select('*');
  const bookings = (bRows || []).map(r => ({
    id: r.id,
    dogName: r.dog_name,
    ownerName: r.owner_name,
    stayStatus: r.stay_status,
    paymentStatus: r.payment_status,
    totalPrice: r.total_price,
    depositAmount: r.deposit_amount,
    startDate: r.start_date,
    endDate: r.end_date,
    refundAmount: r.data?.refundAmount || r.refund_amount,
    refundDate: r.data?.refundDate || r.refund_date,
    data: r.data
  }));

  let totalRefunds = 0;
  bookings.forEach(b => {
    const d = b.data || {};
    const refAmt = Number(b.refundAmount ?? d.refundAmount ?? 0);
    if (refAmt > 0) {
      const refDate = (b.refundDate || d.refundDate || b.startDate || d.startDate || '').substring(0, 7);
      if (refDate === '2026-09') {
        totalRefunds += refAmt;
      }
    }
  });

  console.log('September Total Refunds:', totalRefunds);
}

testBreakdown();

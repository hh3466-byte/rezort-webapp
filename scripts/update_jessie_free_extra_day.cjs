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

async function updateJessie() {
  const id = 'b-1788697331109';
  const { data: current } = await supabase.from('bookings').select('*').eq('id', id).single();
  
  const curData = current?.data || {};
  const updatedData = {
    ...curData,
    endDate: '2026-10-01',
    stayStatus: 'checked_in',
    totalPrice: 1200,
    depositAmount: 1200,
    paymentStatus: 'fully_paid',
    notes: `${curData.notes || ''} | יום נוסף (עד 01.10) באדיבות הריזורט ללא חיוב`.trim(),
    updatedAt: new Date().toISOString()
  };

  const { error } = await supabase.from('bookings').update({
    end_date: '2026-10-01',
    stay_status: 'checked_in',
    total_price: 1200,
    deposit_amount: 1200,
    payment_status: 'fully_paid',
    notes: updatedData.notes,
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', id);

  if (error) {
    console.error('Error updating Jessie:', error);
  } else {
    console.log('Successfully updated Jessie booking to end on 2026-10-01 without extra charge!');
  }
}

updateJessie();

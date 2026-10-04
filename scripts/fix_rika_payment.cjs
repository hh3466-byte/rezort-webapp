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
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: b } = await supabase.from('bookings').select('*').eq('id', 'b-1788697331109').single();
  if (b) {
    const updatedData = {
      ...(b.data || {}),
      depositAmount: 1440,
      totalPrice: 1440,
      paymentStatus: 'fully_paid',
      stayStatus: 'checked_out',
      notes: b.notes
    };
    const { error } = await supabase.from('bookings').update({
      data: updatedData,
      deposit_amount: 1440,
      total_price: 1440,
      payment_status: 'fully_paid',
      stay_status: 'checked_out'
    }).eq('id', 'b-1788697331109');
    console.log('Synchronized JSON data column:', error || 'SUCCESS');
  }
}

run();

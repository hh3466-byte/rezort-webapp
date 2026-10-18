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

async function test() {
  const { data } = await supabase.from('bookings').select('*').eq('id', 'b-1791125093705').single();
  console.log('Top level b:', {
    deposit_amount: data.deposit_amount,
    payment_status: data.payment_status,
    total_price: data.total_price
  });
  console.log('Inside b.data:', data.data);
  const mapped = {
    ...data,
    ...(data.data || {})
  };
  console.log('Mapped object:', {
    deposit_amount: mapped.deposit_amount,
    depositAmount: mapped.depositAmount,
    total_price: mapped.total_price,
    totalPrice: mapped.totalPrice,
    payment_status: mapped.payment_status,
    paymentStatus: mapped.paymentStatus
  });
}

test();

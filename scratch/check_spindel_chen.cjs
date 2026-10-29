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

async function main() {
  const { data: payments } = await supabase.from('grow_incoming_payments').select('*');
  const spindelPayments = (payments || []).filter(p => JSON.stringify(p).includes('ספינדל') || JSON.stringify(p).includes('spindel'));
  const chenPayments = (payments || []).filter(p => JSON.stringify(p).includes('חן לביא') || JSON.stringify(p).includes('0523504549') || JSON.stringify(p).includes('זכויות המורה'));

  console.log('=== Spindel Payments ===');
  console.log(JSON.stringify(spindelPayments, null, 2));

  console.log('=== Chen Lavi Payments ===');
  console.log(JSON.stringify(chenPayments, null, 2));

  const { data: bookings } = await supabase.from('bookings').select('*');
  const spindelBookings = (bookings || []).filter(b => JSON.stringify(b).includes('ספינדל') || JSON.stringify(b).includes('מרים אור') || (b.owner_phone && b.owner_phone.includes('5705976')));
  const chenBookings = (bookings || []).filter(b => JSON.stringify(b).includes('חן לביא') || (b.owner_phone && b.owner_phone.includes('3504549')));

  console.log('=== Spindel Bookings in Resort ===');
  console.log(JSON.stringify(spindelBookings.map(b => ({ id: b.id, dog_name: b.dog_name, owner_name: b.owner_name, total_price: b.total_price, deposit_amount: b.deposit_amount, start_date: b.start_date, end_date: b.end_date, stay_status: b.stay_status })), null, 2));

  console.log('=== Chen Lavi Bookings in Resort ===');
  console.log(JSON.stringify(chenBookings.map(b => ({ id: b.id, dog_name: b.dog_name, owner_name: b.owner_name, total_price: b.total_price, deposit_amount: b.deposit_amount, start_date: b.start_date, end_date: b.end_date, stay_status: b.stay_status })), null, 2));
}

main();

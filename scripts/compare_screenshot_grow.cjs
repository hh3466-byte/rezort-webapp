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

async function checkGrowComparison() {
  const screenshotTransactions = [
    { name: 'ריקה נברי', phone: '0527777737', amount: 1260, date: '22/09/2026', method: 'Bit' },
    { name: 'אייל ברקוביץ\'', phone: '0556694789', amount: 200, date: '22/09/2026', method: 'Apple Pay' },
    { name: 'בוריס ברנר', phone: '0545970156', amount: 2220, date: '21/09/2026', method: 'Bit' },
    { name: 'קארין להב', phone: '0546610321', amount: 440, date: '21/09/2026', method: 'Bit' },
    { name: 'שליו ביטון', phone: '0502845556', amount: 200, date: '20/09/2026', method: 'Gpay' },
    { name: 'זאב אביק', phone: '0507845835', amount: 360, date: '18/09/2026', method: 'אשראי' },
    { name: 'איתי אהרונסון', phone: '0543044647', amount: 2000, date: '18/09/2026', method: 'Gpay' },
    { name: 'רעות פויר', phone: '0545495932', amount: 1350, date: '17/09/2026', method: 'אשראי' },
  ];

  console.log('=== Comparing Screenshot Transactions against Supabase DB ===\n');

  for (const item of screenshotTransactions) {
    const { data: dbGrow } = await supabase
      .from('grow_incoming_payments')
      .select('*')
      .or(`customer_phone.ilike.%${item.phone.slice(-7)}%,customer_name.ilike.%${item.name.split(' ')[0]}%`);

    const { data: dbBooking } = await supabase
      .from('bookings')
      .select('*')
      .or(`owner_phone.ilike.%${item.phone.slice(-7)}%,owner_name.ilike.%${item.name.split(' ')[0]}%`);

    console.log(`🔍 [${item.date}] ${item.name} (₪${item.amount}, ${item.phone}):`);
    console.log(`   - grow_incoming_payments entries found (${dbGrow?.length || 0}):`, dbGrow?.map(g => ({ id: g.id, amount: g.amount, date: g.created_at, status: g.status })));
    console.log(`   - bookings found (${dbBooking?.length || 0}):`, dbBooking?.map(b => ({ id: b.id, dog: b.dog_name, deposit: b.deposit_amount, total: b.total_price, status: b.payment_status })));
    console.log('----------------------------------------------------');
  }

  // Also check Ayelet Fridanzon
  console.log('🔍 Checking איילת פרידנזון / פרדנזון:');
  const { data: ayeletGrow } = await supabase
    .from('grow_incoming_payments')
    .select('*')
    .or(`customer_name.ilike.%איילת%,customer_phone.ilike.%0528787315%`);
  console.log('   - Ayelet in grow_incoming_payments:', ayeletGrow);

  const { data: ayeletBooking } = await supabase
    .from('bookings')
    .select('*')
    .or(`owner_name.ilike.%איילת%,owner_phone.ilike.%0528787315%`);
  console.log('   - Ayelet in bookings:', ayeletBooking);
}

checkGrowComparison();

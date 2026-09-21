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
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(data.map(b => {
    const d = b.data || b;
    return {
      id: b.id,
      created_at: b.created_at,
      dogName: d.dogName || b.dog_name,
      ownerName: d.ownerName || b.owner_name,
      phone: d.ownerPhone || b.owner_phone,
      startDate: d.startDate || b.start_date,
      endDate: d.endDate || b.end_date,
      totalPrice: d.totalPrice,
      depositAmount: d.depositAmount,
      paymentStatus: d.paymentStatus
    };
  }));
}

run();

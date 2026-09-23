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

async function check() {
  const { data: grow } = await supabase
    .from('grow_incoming_payments')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('ALL GROW PAYMENTS (Full info):');
  grow.forEach(g => {
    console.log({
      id: g.id,
      ref: g.reference_id,
      name: g.customer_name,
      phone: g.customer_phone,
      amount: g.amount,
      status: g.status,
      created_at: g.created_at,
      payment_method: g.payment_method
    });
  });

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('\nRECENT BOOKINGS (last 15):');
  bookings.slice(0, 15).forEach(b => {
    console.log({
      id: b.id,
      name: b.owner_name,
      dog: b.dog_name,
      phone: b.owner_phone,
      dates: `${b.start_date} -> ${b.end_date}`,
      deposit: b.deposit_amount,
      total: b.total_price,
      payment_status: b.payment_status,
      stay_status: b.stay_status,
      created_at: b.created_at
    });
  });
}

check();

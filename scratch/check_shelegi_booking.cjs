const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:/Projects/הריזורט לכלב/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkShelegiBookingAndGrow() {
  console.log('=== CHECKING GROW INCOMING PAYMENTS ===');
  const { data: payments } = await supabase
    .from('grow_incoming_payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Recent Grow payments:');
  payments.forEach(p => {
    console.log(`- ID: ${p.id} | Name: ${p.customer_name} | Phone: ${p.customer_phone} | Amount: ${p.amount} | Status: ${p.status} | Created: ${p.created_at}`);
  });

  console.log('\n=== CHECKING BOOKINGS FOR SHELEGI / ORLY ===');
  const { data: b1 } = await supabase
    .from('bookings')
    .select('*')
    .or('dog_name.ilike.%שילגי%,owner_phone.ilike.%3077737%');

  console.log(`Found ${b1?.length || 0} bookings for Shelegi:`);
  b1.forEach(b => {
    console.log(`ID: ${b.id}`);
    console.log(`Dog: ${b.dog_name}, Owner: ${b.owner_name}, Phone: ${b.owner_phone}`);
    console.log(`Dates: ${b.start_date} to ${b.end_date}`);
    console.log(`Total Price: ${b.total_price}, Deposit: ${b.deposit_amount}, Payment Status: ${b.payment_status}, Payment Method: ${b.payment_method}`);
    console.log(`Notes: ${b.notes}`);
    console.log(`Data: ${JSON.stringify(b.data)}`);
  });
}

checkShelegiBookingAndGrow().catch(console.error);

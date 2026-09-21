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
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(16);

  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  bookings.forEach((b, i) => {
    const d = b.data || {};
    console.log(`[${i+1}] ID:${b.id} | Created: ${b.created_at?.slice(0,16)}`);
    console.log(`     Dog: ${b.dog_name || d.dogName} | Breed: ${b.dog_breed || d.dogBreed || 'MISSING'}`);
    console.log(`     Owner: ${b.owner_name || d.ownerName} | Phone: ${b.owner_phone || d.ownerPhone || 'MISSING'} | Email: ${b.owner_email || d.ownerEmail || 'MISSING'}`);
    console.log(`     Dates: ${b.start_date || d.startDate} to ${b.end_date || d.endDate} | Service: ${b.service_type || d.serviceType}`);
    console.log(`     Total: ${b.total_price || d.totalPrice} | Deposit: ${b.deposit_amount || d.depositAmount} | Status: ${b.payment_status || d.paymentStatus}`);
    console.log(`     Emergency: ${b.emergency_contact || d.emergencyContact || 'MISSING'}`);
    console.log(`     Notes: ${b.notes || d.notes || 'none'}`);
  });
}

run();

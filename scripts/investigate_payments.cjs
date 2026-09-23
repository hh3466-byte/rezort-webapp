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

async function investigate() {
  console.log('=== 1. GROW PAYMENTS (ALL RECENT) ===');
  const { data: grow, error: gErr } = await supabase
    .from('grow_incoming_payments')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (gErr) console.error('Grow error:', gErr);
  else {
    console.log(`Found ${grow.length} grow payments:`);
    grow.slice(0, 15).forEach(p => {
      console.log(`- [${p.created_at}] ID: ${p.id} | Name: ${p.customer_name} | Phone: ${p.customer_phone} | Amount: ${p.amount} | Status: ${p.status} | Ref: ${p.reference_id}`);
    });
  }

  console.log('\n=== 2. SEARCH FOR SPECIFIC NAMES ACROSS ALL TABLES ===');
  const names = ['ריקה', 'נברי', 'איילת', 'פרדנזון', 'קארין', 'להב', 'ברקוביץ'];

  for (const name of names) {
    console.log(`\n--- Searching for "${name}" ---`);
    
    const { data: growSearch } = await supabase
      .from('grow_incoming_payments')
      .select('*')
      .ilike('customer_name', `%${name}%`);
    console.log(`  grow_incoming_payments (${growSearch?.length || 0}):`, growSearch);

    const { data: intakeSearch } = await supabase
      .from('intake_requests')
      .select('*')
      .or(`owner_name.ilike.%${name}%,dog_name.ilike.%${name}%`);
    console.log(`  intake_requests (${intakeSearch?.length || 0}):`, intakeSearch?.map(i => ({ id: i.id, created_at: i.created_at, owner_name: i.owner_name, dog_name: i.dog_name, phone: i.phone, status: i.status, form_data: i.form_data })));

    const { data: bookingSearch } = await supabase
      .from('bookings')
      .select('*')
      .or(`owner_name.ilike.%${name}%,dog_name.ilike.%${name}%`);
    console.log(`  bookings (${bookingSearch?.length || 0}):`, bookingSearch?.map(b => ({ id: b.id, created_at: b.created_at, owner_name: b.owner_name, dog_name: b.dog_name, phone: b.owner_phone, deposit_amount: b.deposit_amount, payment_status: b.payment_status, stay_status: b.stay_status })));
  }

  console.log('\n=== 3. ALL INTAKE REQUESTS ===');
  const { data: allIntakes } = await supabase
    .from('intake_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  console.log(allIntakes?.map(i => ({ id: i.id, created_at: i.created_at, owner_name: i.owner_name, dog_name: i.dog_name, phone: i.phone, status: i.status })));
}

investigate();

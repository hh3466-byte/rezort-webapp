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

async function search() {
  console.log('=== SEARCHING FOR ORLY / אורלי / וונר ===');
  
  // 1. Customers
  const { data: c1 } = await supabase.from('customers').select('*').ilike('name', '%אורלי%');
  console.log('Customers with אורלי:', c1);

  const { data: c2 } = await supabase.from('customers').select('*').ilike('name', '%וונר%');
  console.log('Customers with וונר:', c2);

  // 2. Bookings
  const { data: b1 } = await supabase.from('bookings').select('*').ilike('owner_name', '%אורלי%');
  console.log('Bookings with אורלי:', b1);

  const { data: b2 } = await supabase.from('bookings').select('*').ilike('owner_name', '%וונר%');
  console.log('Bookings with וונר:', b2);

  // 3. Intake Requests
  const { data: ir1 } = await supabase.from('intake_requests').select('*').ilike('owner_name', '%אורלי%');
  console.log('Intake with אורלי:', ir1);

  const { data: ir2 } = await supabase.from('intake_requests').select('*').ilike('owner_name', '%וונר%');
  console.log('Intake with וונר:', ir2);

  // 4. Grow Incoming Payments
  const { data: p1 } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false }).limit(20);
  console.log('Recent Grow Payments:', p1);

  // 5. Settings
  const { data: s } = await supabase.from('settings').select('*');
  console.log('Settings:', JSON.stringify(s, null, 2));
}

search().catch(console.error);

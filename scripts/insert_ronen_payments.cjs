const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('--- Inserting 2 payments for Ronen Malamud into grow_incoming_payments ---');
  
  const p1 = {
    id: 'grow_manual_ronen_2000_' + Date.now(),
    reference_id: 'ref-ronen-2000-2317',
    customer_name: 'רונן מלמוד',
    customer_phone: '0524728843',
    customer_email: 'roni876.rm@gmail.com',
    amount: 2000,
    payment_method: 'Bit / אשראי Grow',
    raw_email_snippet: 'תשלום 2000 ש"ח עבור פנסיון - רונן מלמוד (0524728843)',
    status: 'pending',
    created_at: new Date('2026-09-15T20:17:00Z').toISOString()
  };

  const p2 = {
    id: 'grow_manual_ronen_4500_' + (Date.now() + 1),
    reference_id: 'ref-ronen-4500-2323',
    customer_name: 'רונן מלמוד',
    customer_phone: '0524728843',
    customer_email: 'roni876.rm@gmail.com',
    amount: 4500,
    payment_method: 'Bit / אשראי Grow',
    raw_email_snippet: 'תשלום 4500 ש"ח עבור אילוף - רונן מלמוד (0524728843)',
    status: 'pending',
    created_at: new Date('2026-09-15T20:23:00Z').toISOString()
  };

  const { data, error } = await supabase.from('grow_incoming_payments').upsert([p1, p2]);
  if (error) {
    console.error('Error inserting payments:', error);
  } else {
    console.log('✓ Successfully inserted both payments into grow_incoming_payments!');
  }
}

run();

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
  console.log('--- Checking settings.data.intakeRequests ---');
  const { data: sRow, error: sErr } = await supabase
    .from('settings')
    .select('data')
    .eq('id', 'resort_config')
    .single();
  
  if (sErr) {
    console.error('Settings error:', sErr.message);
  } else {
    const list = sRow?.data?.intakeRequests || [];
    console.log('intakeRequests count:', list.length);
    list.forEach((r, i) => {
      console.log(`[${i+1}] ${r.dogName} | בעלים: ${r.ownerName} | נייד: ${r.ownerPhone} | סטטוס: ${r.status}`);
    });
  }

  console.log('\n--- Checking payments table ---');
  const { data: payments, error: pErr } = await supabase.from('payments').select('*').limit(5);
  console.log('payments table:', pErr ? pErr.message : `found ${payments.length} rows`);

  console.log('\n--- Checking dogs table ---');
  const { data: dogs, error: dErr } = await supabase.from('dogs').select('*').limit(5);
  console.log('dogs table:', dErr ? dErr.message : `found ${dogs.length} rows`);

  console.log('\n--- Checking customers table ---');
  const { data: customers, error: cErr } = await supabase.from('customers').select('*').limit(5);
  console.log('customers table:', cErr ? cErr.message : `found ${customers.length} rows`);
}

run();

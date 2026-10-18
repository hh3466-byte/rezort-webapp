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
  const { data: sRow } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  const d = sRow?.data || {};
  console.log('Keys in resort_config:', Object.keys(d));

  const str = JSON.stringify(d);
  console.log('Contains שני in resort_config?', str.includes('שני'));
  console.log('Contains ריקו in resort_config?', str.includes('ריקו'));

  // Search in grow_incoming_payments
  const { data: grow } = await supabase.from('grow_incoming_payments').select('*');
  console.log('Total grow rows:', grow?.length);
  const foundGrow = grow?.filter(g => JSON.stringify(g).includes('שני') || JSON.stringify(g).includes('ריקו'));
  console.log('Grow matching שני/ריקו:', foundGrow);

  // Search in bookings
  const { data: bks } = await supabase.from('bookings').select('*');
  console.log('Total bookings:', bks?.length);
  const foundBks = bks?.filter(b => JSON.stringify(b).includes('שני') || JSON.stringify(b).includes('ריקו'));
  console.log('Bookings matching שני/ריקו:', foundBks);

  // Search in intakeRequests
  const { data: growRecent } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false }).limit(25);
  console.log('Recent 25 grow payments:');
  growRecent?.forEach(g => {
    console.log(`- [${g.created_at}] Amount: ${g.amount} | Client: ${g.client_name} | Desc: ${g.description} | Ref: ${g.grow_payment_id || g.transaction_id || g.id}`);
  });

  console.log('daycare_passes in settings:', JSON.stringify(d.daycare_passes, null, 2));
}

run();

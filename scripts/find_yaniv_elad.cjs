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
  const { data: bookings } = await supabase.from('bookings').select('*');
  const found = (bookings || []).filter(b => 
    (b.owner_name || '').includes('יניב') || 
    (b.owner_name || '').includes('אלעד') ||
    (b.dog_name || '').includes('יניב') ||
    (b.notes || '').includes('יניב') ||
    (b.notes || '').includes('אלעד')
  );
  console.log('Found Yaniv Elad bookings:', found.length);
  found.forEach(b => {
    console.log(JSON.stringify({
      id: b.id,
      dog: b.dog_name,
      owner: b.owner_name,
      phone: b.owner_phone,
      startDate: b.start_date,
      endDate: b.end_date,
      totalPrice: b.total_price,
      deposit: b.deposit_amount,
      status: b.stay_status,
      data: b.data
    }, null, 2));
  });

  // Also search intake requests and customers
  const { data: customers } = await supabase.from('customers').select('*');
  const foundCust = (customers || []).filter(c => (c.name || '').includes('יניב') || (c.name || '').includes('אלעד'));
  console.log('Found customers:', foundCust.map(c => ({ name: c.name, phone: c.phone, dogs: c.dogs })));

  // Also search chats
  const { data: chats } = await supabase.from('whatsapp_chats').select('*').limit(200);
  const foundChat = (chats || []).filter(c => (c.name || '').includes('יניב') || (c.name || '').includes('אלעד') || (c.last_message || '').includes('יניב') || (c.last_message || '').includes('ברח'));
  console.log('Found chats:', foundChat.map(c => ({ id: c.id, name: c.name, phone: c.phone, last_msg: c.last_message })));
}

run();

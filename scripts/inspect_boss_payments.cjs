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
  console.log('=== 1. Checking Itay Aharonson & Ariel Shraiber ===');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
  console.log(`Total Grow payments in DB: ${growPayments?.length || 0}`);

  const itayGrow = (growPayments || []).filter(p => {
    const str = JSON.stringify(p);
    return str.includes('0543044647') || str.includes('0544452521') || str.includes('אהרונסון') || str.includes('שרייבר') || str.includes('איתי') || str.includes('אריאל') || str.includes('4900844785') || p.amount === 4500 || p.amount === 2000 || p.amount === 6500;
  });
  console.log('Matching Grow Payments for Itay/Ariel or amounts 2000/4500/6500:');
  itayGrow.forEach(p => {
    console.log(` - Amount: ₪${p.amount} | Date: ${p.transaction_date || p.created_at} | Payer: ${p.payer_name} | Phone: ${p.payer_phone} | Ref: ${p.grow_payment_id || p.transaction_id || p.reference}`);
  });

  console.log('\n=== 2. Checking Booking for Boss (בוס) ===');
  const { data: bossBookings } = await supabase.from('bookings').select('*').or('dog_name.ilike.%בוס%,owner_phone.ilike.%0543044647%,owner_phone.ilike.%0544452521%');
  bossBookings?.forEach(b => {
    console.log(JSON.stringify(b, null, 2));
  });

  console.log('\n=== 3. Checking WhatsApp Chats for 0543044647 and 0544452521 ===');
  const { data: settings } = await supabase.from('settings').select('*');
  const d = settings?.[0]?.data || {};
  const id = d.greenApiIdInstance;
  const token = d.greenApiToken;

  for (const phone of ['972543044647@c.us', '972544452521@c.us']) {
    try {
      const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: phone, count: 20 })
      });
      const history = await res.json();
      console.log(`Chat history with ${phone}:`);
      if (Array.isArray(history)) {
        history.forEach(m => {
          const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
          const txt = m.textMessage || m.extendedTextMessage?.text || m.typeMessage;
          console.log(`[${date}] [${m.type}] [${m.typeMessage}]:\n${txt?.slice(0, 200)}\n---`);
        });
      } else {
        console.log(history);
      }
    } catch (e) {
      console.error(e);
    }
  }
}

run();

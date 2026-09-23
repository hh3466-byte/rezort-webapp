const fs = require('fs');
const https = require('https');
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

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function getChatHistory(chatId, count = 100) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chatId, count });
    const req = https.request({
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkDetails() {
  console.log('--- Checking all Grow Payments in DB ---');
  const { data: grow } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false });
  console.log(`Total grow payments: ${grow?.length}`);
  grow?.forEach(p => {
    console.log(`[${p.created_at}] ID: ${p.id} | Name: ${p.customer_name} | Phone: ${p.customer_phone} | ₪${p.amount} | Status: ${p.status}`);
  });

  console.log('\n--- Checking specific bookings ---');
  const { data: bookings } = await supabase.from('bookings').select('*').in('owner_name', ['ריקה נברי', 'איילת פרידנזון', 'איילת פרדנזון', 'קארין להב', 'אייל ברקוביץ׳']);
  console.log(bookings?.map(b => ({
    id: b.id,
    owner_name: b.owner_name,
    dog_name: b.dog_name,
    dates: `${b.start_date} -> ${b.end_date}`,
    deposit: b.deposit_amount,
    total: b.total_price,
    payment_status: b.payment_status,
    notes: b.notes,
    created_at: b.created_at
  })));

  console.log('\n--- Checking Shmulik messages containing "תשלום" ---');
  const shmulik = await getChatHistory('972506336896@c.us', 100);
  if (Array.isArray(shmulik)) {
    const payMsgs = shmulik.filter(m => (m.textMessage || '').includes('תשלום') || (m.textMessage || '').includes('Grow'));
    console.log(`Found ${payMsgs.length} payment notifications in Shmulik chat:`);
    payMsgs.forEach(m => {
      const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`- [${date}]:\n${m.textMessage}\n`);
    });
  }

  console.log('\n--- Checking Manager messages containing "תשלום" ---');
  const manager = await getChatHistory('972543200007@c.us', 100);
  if (Array.isArray(manager)) {
    const payMsgs = manager.filter(m => (m.textMessage || '').includes('תשלום') || (m.textMessage || '').includes('Grow'));
    console.log(`Found ${payMsgs.length} payment notifications in Manager chat:`);
    payMsgs.forEach(m => {
      const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`- [${date}]:\n${m.textMessage}\n`);
    });
  }
}

checkDetails();

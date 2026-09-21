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
  const { data: settingsData } = await supabase.from('settings').select('*');
  const d = settingsData[0]?.data || {};
  console.log('Manager Phone:', d.managerPhone);
  console.log('WhatsApp Notification Phone:', d.whatsappNotificationPhone);
  console.log('GreenAPI Instance:', d.greenApiIdInstance);
  
  const id = d.greenApiIdInstance;
  const token = d.greenApiToken;

  const phone = d.whatsappNotificationPhone || d.managerPhone || '0506816001';
  const clean = phone.replace(/\D/g, '');
  const intlPhone = clean.startsWith('0') ? '972' + clean.slice(1) : clean;
  const chatId = intlPhone + '@c.us';
  console.log('Checking chatId:', chatId);

  // Check last messages in this chat
  const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count: 10 })
  });
  const history = await res.json();
  console.log('Last messages with Shmulik:');
  if (Array.isArray(history)) {
    history.forEach(m => {
      const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage);
      console.log(`[${date}] [${m.type}] [${m.typeMessage}]: ${text?.substring(0, 150)}...`);
    });
  } else {
    console.log('History response:', history);
  }

  // Also check 0506336896 if different
  if (chatId !== '972506336896@c.us') {
    console.log('\nChecking alternative 972506336896@c.us:');
    const res2 = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972506336896@c.us', count: 5 })
    });
    const hist2 = await res2.json();
    if (Array.isArray(hist2)) {
      hist2.forEach(m => {
        const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage);
        console.log(`[${date}] [${m.type}] [${m.typeMessage}]: ${text?.substring(0, 150)}...`);
      });
    }
  }
}

run();

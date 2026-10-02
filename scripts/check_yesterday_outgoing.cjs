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

async function checkYesterdayOutgoing() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  console.log('--- Green API State & Queue ---');
  try {
    const stRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getStateInstance/${greenToken}`);
    console.log('State:', await stRes.json());
    const qRes = await fetch(`https://api.green-api.com/waInstance${greenId}/showMessagesQueue/${greenToken}`);
    console.log('Queue:', await qRes.json());
  } catch (e) {
    console.error('Err checking state/queue:', e);
  }

  console.log('\n--- Checking Outgoing Messages (last 24h / 1440 min) ---');
  const outRes = await fetch(`https://api.green-api.com/waInstance${greenId}/lastOutgoingMessages/${greenToken}?minutes=1440`);
  const outMsgs = await outRes.json();
  if (Array.isArray(outMsgs)) {
    console.log(`Total outgoing messages in last 24h: ${outMsgs.length}`);
    outMsgs.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
      console.log(`[${time}] To: ${m.chatId} Status: ${m.statusMessage} Text: "${text.substring(0, 100).replace(/\n/g, ' ')}"`);
    });
  } else {
    console.log('Outgoing msgs response:', outMsgs);
  }

  console.log('\n--- Checking Shmulik & Hagai Chat for yesterday evening ---');
  const shmulikHistRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 30 })
  });
  const shmulikMsgs = await shmulikHistRes.json();
  if (Array.isArray(shmulikMsgs)) {
    console.log(`Shmulik messages count: ${shmulikMsgs.length}`);
    shmulikMsgs.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
      console.log(`[${time}] Type:${m.type} Text: "${text.substring(0, 120).replace(/\n/g, ' ')}"`);
    });
  }
}

checkYesterdayOutgoing().catch(console.error);

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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
  // 1. Check settings
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings[0];
  console.log('=== SETTINGS INTAKES / FORMS / DATA ===');
  for (const key of Object.keys(s)) {
    const val = s[key];
    const str = JSON.stringify(val);
    if (str && (str.includes('ניבה') || str.includes('פורן') || str.includes('0507900781') || str.includes('507900781') || str.includes('7900781'))) {
      console.log(`Key: ${key}`);
      if (Array.isArray(val)) {
        const matchingItems = val.filter(item => JSON.stringify(item).includes('ניבה') || JSON.stringify(item).includes('פורן') || JSON.stringify(item).includes('7900781'));
        console.log(`Found ${matchingItems.length} items in array:`, JSON.stringify(matchingItems, null, 2));
      } else {
        console.log('Value:', JSON.stringify(val, null, 2));
      }
    }
  }

  // 2. Fetch full WhatsApp chat history
  console.log('\n=== WHATSAPP CHAT HISTORY (972507900781@c.us) ===');
  const id = '710722735421';
  const tok = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const chatId = '972507900781@c.us';

  const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${tok}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count: 50 })
  });

  if (res.ok) {
    const msgs = await res.json();
    console.log(`Fetched ${msgs.length} messages:`);
    msgs.reverse().forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || (m.message && JSON.stringify(m.message)) || `[${m.typeMessage}]`;
      console.log(`[${time}] ${m.type} (${m.senderName || m.chatId}):\n${text}\n-------------------`);
    });
  } else {
    console.log('Error fetching chat history:', res.status, await res.text());
  }
}

run();

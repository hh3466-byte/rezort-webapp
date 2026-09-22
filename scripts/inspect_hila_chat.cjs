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
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;
  console.log('Green API credentials present:', !!greenId, !!greenToken);

  if (!greenId || !greenToken) return;

  const hilaChatId = '972526908943@c.us';
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: hilaChatId, count: 50 })
    });
    const msgs = await res.json();
    console.log('Hila chat history length:', Array.isArray(msgs) ? msgs.length : msgs);
    if (Array.isArray(msgs)) {
      msgs.forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
        const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
        console.log(`[${time}] ${m.type}: ${text.replace(/\n/g, ' ')}`);
      });
    }
  } catch (e) {
    console.error('Error querying Hila chat:', e);
  }
}

run();

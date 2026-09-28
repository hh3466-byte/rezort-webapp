const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function checkRazChat() {
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
  const { data: rows } = await supabase.from('settings').select('*').limit(1);
  const s = rows?.[0]?.data || {};
  const id = s.greenApiIdInstance;
  const token = s.greenApiToken;
  const chatId = '972543180407@c.us';

  console.log('Fetching chat history for Raz:', chatId);
  const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count: 10 })
  });
  const hist = await res.json();
  if (Array.isArray(hist)) {
    hist.forEach(m => {
      const time = new Date((m.timestamp || 0) * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '[מדיה/קובץ]';
      console.log(`[${time}] ${m.type.toUpperCase()}: ${text}\n`);
    });
  } else {
    console.log('Response:', hist);
  }
}

checkRazChat();

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
  const d = settings?.[0]?.data || {};
  const id = d.greenApiIdInstance;
  const token = d.greenApiToken;

  const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 15 })
  });
  const history = await res.json();
  if (Array.isArray(history)) {
    history.forEach(m => {
      const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const txt = m.textMessage || m.extendedTextMessage?.text || m.typeMessage;
      if (txt && txt.includes('סקאי')) {
        console.log(`=== Message on ${date} ===\n${txt}\n`);
      }
    });
  }
}

run();

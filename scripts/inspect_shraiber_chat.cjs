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

async function inspectChat() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings[0]?.data || {};
  const id = s.greenApiIdInstance;
  const token = s.greenApiToken;

  const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972544452521@c.us', count: 20 })
  });
  const hist = await res.json();
  console.log(JSON.stringify(hist.map(m => ({
    timestamp: new Date(m.timestamp * 1000).toLocaleString('he-IL'),
    type: m.type,
    text: m.textMessage || m.extendedTextMessage?.text
  })), null, 2));
}

inspectChat();

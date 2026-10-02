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

async function checkHagaiChat() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  const hRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 30 })
  });
  const msgs = await hRes.json();
  if (Array.isArray(msgs)) {
    console.log(`Hagai chat messages count: ${msgs.length}`);
    msgs.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
      console.log(`[${time}] ID:${m.idMessage} Type:${m.type} Text:\n${text}\n-------------------`);
    });
  }
}

checkHagaiChat().catch(console.error);

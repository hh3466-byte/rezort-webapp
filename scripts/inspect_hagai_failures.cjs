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

async function inspectHagaiEveningLogs() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  console.log('--- Fetching last 50 messages from Hagai (972543200007@c.us) ---');
  const hRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 50 })
  });
  const msgs = await hRes.json();
  if (Array.isArray(msgs)) {
    msgs.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
      if (text.includes('כשל') || text.includes('20:00') || text.includes('19:00') || text.includes('סיכום') || text.includes('ד"ש') || text.includes('חוות דעת') || time.includes('1.10.2026')) {
        console.log(`[${time}] ID:${m.idMessage} Type:${m.type} Text:\n${text}\n-------------------`);
      }
    });
  }
}

inspectHagaiEveningLogs().catch(console.error);

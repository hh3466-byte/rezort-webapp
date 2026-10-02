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

async function inspectOct1Messages() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  // Let's get outgoing messages on 01.10.2026 between 18:00 and 23:00
  // minutes = 2880 (last 48 hours)
  console.log('--- Checking all outgoing messages from last 48 hours ---');
  const outRes = await fetch(`https://api.green-api.com/waInstance${greenId}/lastOutgoingMessages/${greenToken}?minutes=2880`);
  const outMsgs = await outRes.json();
  if (Array.isArray(outMsgs)) {
    const eveningMsgs = outMsgs.filter(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      return time.includes('1.10.2026') && (time.includes('19:') || time.includes('20:') || time.includes('21:') || time.includes('22:'));
    });
    console.log(`Total evening messages sent on 01.10.2026: ${eveningMsgs.length}`);
    eveningMsgs.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
      console.log(`[${time}] To: ${m.chatId} Status: ${m.statusMessage} Text: "${text.substring(0, 100).replace(/\n/g, ' ')}"`);
    });
  }
}

inspectOct1Messages().catch(console.error);

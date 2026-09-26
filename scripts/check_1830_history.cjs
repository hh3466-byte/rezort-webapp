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

async function run() {
  const idInstance = env.VITE_GREEN_API_ID_INSTANCE || '710722735421';
  const apiToken = env.VITE_GREEN_API_TOKEN || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  const managerChatId = '972543200007@c.us';

  const url = `https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: managerChatId, count: 20 })
  });

  const history = await resp.json();
  console.log(`Fetched ${history.length} messages for manager 054-3200007:`);
  
  history.forEach((m, idx) => {
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const snippet = (m.textMessage || m.extendedTextMessage?.text || '').slice(0, 100);
    console.log(`[${idx}] ${time} (${m.type}) - ${snippet.replace(/\n/g, ' ')}`);
  });

  // Check Supabase settings
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  console.log('\nSupabase Settings 18:30 flags:');
  console.log('last1830SanitySentDate:', settings?.data?.last1830SanitySentDate);
  console.log('last1830SanitySentTimestamp:', settings?.data?.last1830SanitySentTimestamp);
}

run();

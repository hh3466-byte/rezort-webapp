const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

async function check() {
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);
  const { data: sRows } = await supabase.from('settings').select('*');
  const settings = sRows?.[0]?.data || {};
  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;

  const res = await fetch(`https://api.green-api.com/waInstance${greenId}/GetChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 5 })
  });
  const msgs = await res.json();
  console.log('Last messages with Hagai:');
  msgs.forEach(m => {
    console.log('--- MSG ---', new Date((m.timestamp || 0) * 1000).toLocaleString('he-IL'), m.type);
    console.log(m.textMessage || m.extendedTextMessage?.text);
  });
}
check();

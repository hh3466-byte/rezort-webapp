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

async function run() {
  const { data } = await supabase.from('settings').select('*');
  const d = data[0]?.data || {};
  const id = d.greenApiIdInstance;
  const token = d.greenApiToken;

  for (const chatId of ['972506336996@c.us', '972506336896@c.us']) {
    const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count: 5 })
    });
    const json = await res.json();
    console.log(`Chat ${chatId}:`, JSON.stringify(json, null, 2));
  }
}
run();

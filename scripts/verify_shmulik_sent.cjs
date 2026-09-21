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

async function checkSent() {
  const { data } = await supabase.from('settings').select('*');
  const d = data[0]?.data || {};
  const id = d.greenApiIdInstance;
  const token = d.greenApiToken;

  const url = `https://api.green-api.com/waInstance${id}/lastOutgoingMessages/${token}?minutes=10`;
  const res = await fetch(url);
  const msgs = await res.json();
  const shmulikMsg = msgs.find(m => m.chatId === '972506336896@c.us');
  console.log('Last outgoing to Shmulik:', JSON.stringify(shmulikMsg, null, 2));
}

checkSent();

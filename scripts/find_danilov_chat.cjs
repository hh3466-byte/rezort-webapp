const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('settings').select('*');
  const d = data && data[0] ? (data[0].data || data[0]) : {};
  console.log('managerPhone:', d.managerPhone, 'whatsappNotificationPhone:', d.whatsappNotificationPhone);
  const id = d.greenApiIdInstance || '7105267323';
  const token = d.greenApiToken || 'f6ce83ecde134f719b9175ef36e5ca9a2245b73d8f814980a3';
  const res = await fetch(`https://api.green-api.com/waInstance${id}/getChats/${token}`);
  if (res.ok) {
    const chats = await res.json();
    const matches = chats.filter(c => 
      (c.name && (c.name.includes('דנילוב') || c.name.includes('שמוליק') || c.name.includes('חגי') || c.name.includes('מגדל'))) ||
      (c.id && (c.id.includes('506336896') || c.id.includes('506816001') || c.id.includes('548765888')))
    );
    console.log('Matches:', matches);
  }
}
run();

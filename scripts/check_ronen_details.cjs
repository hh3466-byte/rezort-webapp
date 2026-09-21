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
  const { data: customers } = await supabase.from('customers').select('*').or('phone.ilike.%4728843%,name.ilike.%רונן%');
  console.log('Customers table:', customers);

  // Check green api messages for 0524728843 or 972524728843
  const https = require('https');
  const idInstance = '710722735421';
  const apiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const url = `https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`;
  const req = https.request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
      console.log('Chat history for 972524728843:', raw.slice(0, 300));
    });
  });
  req.write(JSON.stringify({ chatId: '972524728843@c.us', count: 5 }));
  req.end();
}

run();

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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
const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function fetchGreen(endpoint, body = null, method = 'GET') {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.green-api.com',
      path: `/waInstance${id}/${endpoint}/${token}`,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const { data: dbBookings } = await supabase.from('bookings').select('*');
  const matched = (dbBookings || []).filter(b => {
    const str = JSON.stringify(b);
    return str.includes('סקובי') || str.includes('ג\'ינגס') || str.includes('שליו') || str.includes('Scooby') || str.includes('Jinx');
  });

  console.log('--- MATCHED BOOKINGS ---');
  matched.forEach(b => {
    console.log({
      id: b.id,
      dog_name: b.dog_name,
      owner_name: b.owner_name,
      owner_phone: b.owner_phone,
      start_date: b.start_date,
      end_date: b.end_date,
      stay_status: b.stay_status
    });
  });

  const phones = [...new Set(matched.map(b => b.owner_phone).filter(Boolean))];
  console.log('Phones to inspect:', phones);

  for (const p of phones) {
    let clean = p.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '972' + clean.slice(1);
    const chatId = `${clean}@c.us`;
    console.log(`\n--- CHAT HISTORY FOR ${p} (${chatId}) ---`);
    const history = await fetchGreen('getChatHistory', { chatId, count: 10 }, 'POST');
    if (Array.isArray(history)) {
      history.forEach(m => {
        console.log(`[${m.type}] ${m.statusMessage || ''} | ${m.textMessage || m.extendedTextMessage?.text || JSON.stringify(m)}`);
      });
    } else {
      console.log('History response:', history);
    }
  }
}

run();

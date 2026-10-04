const fs = require('fs');
const https = require('https');
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

function fetchPost(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch(e) { resolve({ error: e.message, raw }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function fetchGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch(e) { resolve({ error: e.message, raw }); }
      });
    }).on('error', reject);
  });
}

async function check() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  console.log('Today:', today);

  const { data: settingsRows } = await supabase.from('resort_settings').select('*').limit(1);
  const settings = settingsRows && settingsRows[0] ? settingsRows[0] : {};
  const idInstance = settings.green_api_id_instance || '710722735421';
  const apiToken = settings.green_api_token || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  // Check state instance
  const stateUrl = `https://api.green-api.com/waInstance${idInstance}/getStateInstance/${apiToken}`;
  const stateRes = await fetchGet(stateUrl);
  console.log('Green API State:', JSON.stringify(stateRes));

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, dog_name, owner_name, owner_phone, start_date, end_date, stay_status, data')
    .lte('start_date', today)
    .gt('end_date', today)
    .neq('stay_status', 'cancelled');

  console.log(`\nFound ${bookings ? bookings.length : 0} active dogs staying tonight:`);
  if (bookings) {
    for (const b of bookings) {
      const phone = (b.owner_phone || '').replace(/[^0-9]/g, '');
      const intlPhone = phone.startsWith('0') ? '972' + phone.substring(1) : phone;
      const chatId = intlPhone + '@c.us';
      const lastDaily = b.data?.lastDailyDogUpdateSent;
      console.log(`- ${b.dog_name} (${b.owner_name}, ${chatId}) | stay: ${b.start_date} -> ${b.end_date} | lastDaily: ${lastDaily}`);
      
      // Check last message in chat history
      try {
        const histUrl = `https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`;
        const hist = await fetchPost(histUrl, { chatId, count: 2 });
        if (Array.isArray(hist) && hist.length > 0) {
          const lastMsg = hist[0];
          const time = lastMsg.timestamp ? new Date(lastMsg.timestamp * 1000).toLocaleTimeString('he-IL') : 'N/A';
          console.log(`   Last message (${time}): [${lastMsg.type}] ${lastMsg.textMessage?.slice(0, 60) || lastMsg.caption?.slice(0, 60) || ''}`);
        }
      } catch (eHist) {
        console.log(`   Error fetching hist: ${eHist.message}`);
      }
    }
  }
}

check();

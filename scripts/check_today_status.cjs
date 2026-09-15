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

async function check() {
  const today = '2026-09-15';
  console.log('--- Checking bookings for today:', today, '---');
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, dog_name, owner_name, owner_phone, start_date, end_date, stay_status')
    .lte('start_date', today)
    .gt('end_date', today)
    .neq('stay_status', 'cancelled');

  console.log('Bookings active tonight count:', bookings?.length, 'error:', error);
  if (bookings && bookings.length > 0) {
    bookings.forEach(b => console.log(`- ${b.dog_name} (${b.owner_name}, ${b.owner_phone}) [${b.start_date} -> ${b.end_date}]`));
  }

  // Also check Green API outgoing messages in the last 300 minutes (5 hours)
  const idInstance = '710722735421';
  const apiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const url = `https://api.green-api.com/waInstance${idInstance}/lastOutgoingMessages/${apiToken}?minutes=300`;
  
  https.get(url, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const msgs = JSON.parse(raw);
        console.log('\n--- Green API Outgoing messages in last 300 minutes: ---');
        console.log('Total outgoing messages:', Array.isArray(msgs) ? msgs.length : msgs);
        if (Array.isArray(msgs)) {
          msgs.forEach((m, idx) => {
            const time = new Date(m.timestamp * 1000).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
            const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage || 'media');
            console.log(`[${idx + 1}] Time: ${time} | To: ${m.chatId}\n    Text: ${text.slice(0, 100)}...`);
          });
        }
      } catch(e) {
        console.log('Error parsing Green API response:', raw.slice(0, 200));
      }
    });
  }).on('error', e => console.error('Green API request error:', e));
}

check();

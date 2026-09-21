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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          resolve({ error: e.message, raw: raw.slice(0, 300) });
        }
      });
    }).on('error', reject);
  });
}

async function checkEveningOutgoing() {
  const { data: settingsRows } = await supabase.from('resort_settings').select('*').limit(1);
  const settings = settingsRows && settingsRows[0] ? settingsRows[0] : {};
  const idInstance = settings.green_api_id_instance || '710722735421';
  const apiToken = settings.green_api_token || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  // Get active bookings
  const today = '2026-09-17';
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .lte('start_date', today)
    .gt('end_date', today)
    .neq('stay_status', 'cancelled');

  console.log('=== ACTIVE DOGS TONIGHT (' + today + ') ===');
  const bookingMap = {};
  if (bookings) {
    bookings.forEach(b => {
      const cleanPhone = b.owner_phone ? b.owner_phone.replace(/\D/g, '') : '';
      bookingMap[cleanPhone] = b;
      const last7 = cleanPhone.slice(-7);
      bookingMap[last7] = b;
      console.log(`- ${b.dog_name} | בעלים: ${b.owner_name} | טלפון: ${b.owner_phone} | שירות: ${b.service_type}`);
    });
  }

  // Get outgoing messages in last 120 minutes (2 hours)
  const url = `https://api.green-api.com/waInstance${idInstance}/lastOutgoingMessages/${apiToken}?minutes=120`;
  const outgoing = await fetchJson(url);

  console.log('\n=== OUTGOING MESSAGES SENT IN THE LAST 2 HOURS (AROUND 20:00) ===');
  if (Array.isArray(outgoing)) {
    console.log(`Found ${outgoing.length} outgoing messages:\n`);
    outgoing.forEach((m, idx) => {
      const dateObj = new Date(m.timestamp * 1000);
      const timeStr = dateObj.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage || 'media');
      const cleanChat = m.chatId ? m.chatId.replace(/@c\.us/g, '') : '';
      const matchedB = bookingMap[cleanChat] || bookingMap[cleanChat.slice(-7)];

      console.log(`----------------------------------------------------------------------`);
      console.log(`[#${idx + 1}] שעה: ${timeStr} | נמען: ${m.chatId} ${matchedB ? `(🐾 כלב: ${matchedB.dog_name}, בעלים: ${matchedB.owner_name})` : ''}`);
      console.log(`תוכן ההודעה:`);
      console.log(text);
    });
  } else {
    console.log('Error or empty response:', outgoing);
  }
}

checkEveningOutgoing().catch(console.error);

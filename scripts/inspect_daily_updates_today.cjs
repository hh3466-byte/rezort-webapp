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

async function main() {
  const today = '2026-09-17';
  console.log(`=== CHECKING DAILY UPDATES FOR TODAY: ${today} ===\n`);

  // 1. Fetch Resort Settings
  const { data: settingsRows } = await supabase.from('resort_settings').select('*').limit(1);
  const settings = settingsRows && settingsRows[0] ? settingsRows[0] : {};
  const idInstance = settings.green_api_id_instance || '710722735421';
  const apiToken = settings.green_api_token || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  console.log(`Green-API Instance: ${idInstance}`);

  // 2. Fetch Active Bookings Tonight
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .lte('start_date', today)
    .gt('end_date', today)
    .neq('stay_status', 'cancelled');

  console.log(`\n--- DOGS STAYING TONIGHT (${today}): ${bookings?.length || 0} ---`);
  if (bookings && bookings.length > 0) {
    bookings.forEach((b, idx) => {
      console.log(`${idx + 1}. 🐾 ${b.dog_name} (בעלים: ${b.owner_name}, טלפון: ${b.owner_phone}) | שירות: ${b.service_type} | תאריכים: ${b.start_date} -> ${b.end_date}`);
    });
  } else {
    console.log('No active bookings staying tonight.');
  }

  // 3. Fetch Green API outgoing messages for the past 600 minutes (10 hours)
  console.log('\n--- GREEN-API OUTGOING MESSAGES (TODAY) ---');
  const url = `https://api.green-api.com/waInstance${idInstance}/lastOutgoingMessages/${apiToken}?minutes=600`;
  try {
    const outgoing = await fetchJson(url);
    if (Array.isArray(outgoing)) {
      console.log(`Total outgoing messages found in last 10 hours: ${outgoing.length}`);
      outgoing.forEach((m, idx) => {
        const dateObj = new Date(m.timestamp * 1000);
        const timeStr = dateObj.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const dateStr = dateObj.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage || 'media');
        console.log(`\n[${idx + 1}] Date: ${dateStr} ${timeStr} | To: ${m.chatId}`);
        console.log(`Message:\n${text}`);
      });
    } else {
      console.log('Response from Green API:', outgoing);
    }
  } catch (err) {
    console.error('Error fetching Green API outgoing messages:', err.message);
  }

  // 4. Fetch Green API incoming messages for the past 600 minutes (10 hours)
  console.log('\n--- GREEN-API INCOMING MESSAGES (TODAY) ---');
  const inUrl = `https://api.green-api.com/waInstance${idInstance}/lastIncomingMessages/${apiToken}?minutes=600`;
  try {
    const incoming = await fetchJson(inUrl);
    if (Array.isArray(incoming)) {
      console.log(`Total incoming messages found in last 10 hours: ${incoming.length}`);
      incoming.forEach((m, idx) => {
        const dateObj = new Date(m.timestamp * 1000);
        const timeStr = dateObj.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage || 'media');
        console.log(`[${idx + 1}] Time: ${timeStr} | From: ${m.chatId} (${m.senderName || ''}) : ${text.slice(0, 80)}`);
      });
    } else {
      console.log('Response:', incoming);
    }
  } catch (err) {
    console.error('Error fetching incoming:', err.message);
  }
}

main().catch(console.error);

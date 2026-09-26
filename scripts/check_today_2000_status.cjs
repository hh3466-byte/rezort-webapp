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
  const today = '2026-09-23';
  console.log(`=== CHECKING 20:00 UPDATES AND REPORTS FOR TODAY: ${today} ===\n`);

  // 1. Settings
  const { data: settingsRows } = await supabase.from('resort_settings').select('*').limit(1);
  const settings = settingsRows && settingsRows[0] ? settingsRows[0] : {};
  const idInstance = settings.green_api_id_instance || '710722735421';
  const apiToken = settings.green_api_token || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  console.log(`Resort settings found. Evening greeting status in settings:`, settings.evening_greeting_status || 'N/A');

  // 2. Active bookings staying tonight
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .lte('start_date', today)
    .gt('end_date', today)
    .neq('stay_status', 'cancelled');

  console.log(`\n--- DOGS STAYING TONIGHT (${today}): ${bookings?.length || 0} ---`);
  bookings?.forEach((b, i) => {
    console.log(`${i+1}. 🐾 ${b.dog_name} (בעלים: ${b.owner_name}, טלפון: ${b.owner_phone}) | חדר: ${b.kennel_id || 'ללא'}`);
  });

  // 3. Green API outgoing in last 300 minutes (5 hours - covering 17:30 to 22:30)
  const url = `https://api.green-api.com/waInstance${idInstance}/lastOutgoingMessages/${apiToken}?minutes=300`;
  const outgoing = await fetchJson(url);

  console.log(`\n--- GREEN API OUTGOING MESSAGES (PAST 5 HOURS) ---`);
  if (Array.isArray(outgoing)) {
    console.log(`Found ${outgoing.length} outgoing messages:`);
    outgoing.forEach((m, idx) => {
      const dateObj = new Date(m.timestamp * 1000);
      const timeStr = dateObj.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage || 'media');
      console.log(`\n[#${idx+1}] Time: ${timeStr} | To: ${m.chatId}`);
      console.log(`Message: ${text.slice(0, 180)}...`);
    });
  } else {
    console.log('Error / Non-array response from Green-API:', outgoing);
  }
}

main().catch(console.error);

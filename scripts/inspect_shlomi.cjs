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
  console.log('=== INSPECTING SHLOMI (050-5445512) ===\n');

  // 1. Bookings in Supabase
  const { data: bookings } = await supabase.from('bookings').select('*');
  const shlomiBookings = (bookings || []).filter(b => {
    const p = (b.owner_phone || b.ownerPhone || '').replace(/\D/g, '');
    return p.includes('5445512') || (b.owner_name || b.ownerName || '').includes('שלומי');
  });

  console.log('Bookings for Shlomi:');
  console.log(JSON.stringify(shlomiBookings, null, 2));

  // 2. All bookings with dogName containing לונה or לוסי
  const lunaBookings = (bookings || []).filter(b => {
    const n = (b.dog_name || b.dogName || '');
    return n.includes('לונה') || n.includes('לוסי');
  });
  console.log('\nAll Bookings with לונה or לוסי:');
  lunaBookings.forEach(b => {
    console.log(`- ${b.dog_name || b.dogName} | בעלים: ${b.owner_name || b.ownerName} | טלפון: ${b.owner_phone || b.ownerPhone} | תאריכים: ${b.start_date || b.startDate} -> ${b.end_date || b.endDate}`);
  });

  // 3. Intake requests
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const shlomiIntakes = (intakes || []).filter(r => {
    const p = (r.owner_phone || r.ownerPhone || '').replace(/\D/g, '');
    return p.includes('5445512') || (r.owner_name || r.ownerName || '').includes('שלומי');
  });
  console.log('\nIntakes for Shlomi:', shlomiIntakes);

  // 4. WhatsApp chat history with Shlomi
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const idInstance = settings.greenApiIdInstance || '710722735421';
  const apiToken = settings.greenApiToken || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  const historyUrl = `https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`;
  const postData = JSON.stringify({ chatId: '972505445512@c.us', count: 10 });
  
  const req = https.request({
    hostname: 'api.green-api.com',
    port: 443,
    path: `/waInstance${idInstance}/getChatHistory/${apiToken}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const hist = JSON.parse(raw);
        console.log('\nChat history with Shlomi:');
        hist.forEach((m, idx) => {
          const d = new Date(m.timestamp * 1000).toLocaleString('he-IL');
          const t = m.textMessage || m.extendedTextMessage?.text || m.typeMessage;
          console.log(`[${idx+1}] ${d} (${m.type}): ${t?.slice(0, 150)}`);
        });
      } catch (e) {
        console.log('Error parsing chat history:', e.message);
      }
    });
  });
  req.write(postData);
  req.end();
}

main().catch(console.error);

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

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function getChatHistory(chatId) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ chatId, count: 50 });
    const req = https.request({
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: e.message, raw: body });
        }
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== Chat History for Itay Aharonson (0543044647) ===');
  const itayHist = await getChatHistory('972543044647@c.us');
  if (Array.isArray(itayHist)) {
    console.log(`Retrieved ${itayHist.length} messages for Itay:`);
    itayHist.forEach(m => {
      const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const txt = m.textMessage || m.extendedTextMessage?.text || m.typeMessage;
      console.log(`[${date}] [${m.type}]: ${txt}`);
    });
  } else {
    console.log('Itay Hist:', itayHist);
  }

  console.log('\n=== Chat History for Ariel Shraiber (0544452521) ===');
  const arielHist = await getChatHistory('972544452521@c.us');
  if (Array.isArray(arielHist)) {
    console.log(`Retrieved ${arielHist.length} messages for Ariel:`);
    arielHist.forEach(m => {
      const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const txt = m.textMessage || m.extendedTextMessage?.text || m.typeMessage;
      console.log(`[${date}] [${m.type}]: ${txt}`);
    });
  } else {
    console.log('Ariel Hist:', arielHist);
  }
}

run();

const fs = require('fs');
const https = require('https');

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function getChatHistory(chatId, count = 50) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chatId, count });
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
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const phone = '972528787315@c.us';
  console.log('=== Checking chat with Ayelet Fridanzon (' + phone + ') ===');
  const history = await getChatHistory(phone, 30);
  if (Array.isArray(history)) {
    console.log(`Found ${history.length} messages:`);
    history.forEach(m => {
      const d = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`[${d}] ${m.type} (${m.typeMessage}): ${m.textMessage || m.caption || (m.downloadUrl ? 'IMAGE: ' + m.downloadUrl : '')}`);
    });
  } else {
    console.log('Response:', history);
  }
}

run();

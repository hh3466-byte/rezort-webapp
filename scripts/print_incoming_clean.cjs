const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function fetchGreenApi(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/${endpoint}/${GREEN_API_TOKEN}`,
      method: method,
      headers: {
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== LAST INCOMING MESSAGES ===');
  const inc = await fetchGreenApi('lastIncomingMessages', 'GET');
  console.log(`Total count: ${inc?.length}`);
  if (Array.isArray(inc)) {
    inc.slice(0, 15).forEach((m, idx) => {
      const t = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`[${idx}] Chat: ${m.chatId} | Sender: ${m.senderId} (${m.senderName || ''}) | Time: ${t}`);
      console.log(`     Type: ${m.typeMessage} | Text: ${m.textMessage || m.caption || '(no text)'}`);
      console.log(`     URL: ${m.downloadUrl || ''}`);
    });
  }
}

run().catch(console.error);

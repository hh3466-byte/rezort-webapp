const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function fetchGreenApi(endpoint, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/${endpoint}/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
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
    req.write(postData);
    req.end();
  });
}

async function main() {
  const chatId = '972528191261@c.us';
  const history = await fetchGreenApi('getChatHistory', { chatId, count: 40 });
  console.log('=== CHAT HISTORY WITH LIRON ABTA (SANDY) ===');
  if (Array.isArray(history)) {
    history.reverse().forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || (m.extendedTextMessage && m.extendedTextMessage.text) || m.caption || (m.typeMessage || '[media]');
      console.log(`[${time}] ${m.type === 'outgoing' ? 'OUT' : 'IN'}: ${text}`);
    });
  } else {
    console.log(history);
  }
}

main().catch(console.error);

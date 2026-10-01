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
  const hagai = await fetchGreenApi('getChatHistory', 'POST', { chatId: '972543200007@c.us', count: 25 });
  console.log('--- Hagai Chat History (054-3200007) ---');
  if (Array.isArray(hagai)) {
    hagai.forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const txt = m.textMessage || (m.extendedTextMessage && m.extendedTextMessage.text) || m.caption || `[${m.typeMessage}]`;
      console.log(`[${time}] ${m.type} (${m.typeMessage}): ${txt}`);
    });
  } else {
    console.log('Hagai response:', hagai);
  }
}

run();

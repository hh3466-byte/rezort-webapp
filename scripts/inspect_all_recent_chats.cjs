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
  console.log('=== Checking all recent chats ===');
  const chats = await fetchGreenApi('getChats', 'GET');
  if (Array.isArray(chats)) {
    console.log(`Total chats: ${chats.length}`);
    chats.slice(0, 15).forEach(c => {
      const lm = c.lastMessage || {};
      const time = lm.timestamp ? new Date(lm.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : 'N/A';
      console.log(`Chat: ${c.id} (${c.name || 'No Name'}) | Last Msg: [${time}] [${lm.type}] ${lm.textMessage || lm.caption || ''}`);
    });
  } else {
    console.log('Chats response:', chats);
  }
}

run();

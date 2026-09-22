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

async function run() {
  console.log('--- Checking Chat History for Shmulik 0506336896 ---');
  const shmulikChat = await fetchGreenApi('GetChatHistory', {
    chatId: '972506336896@c.us',
    count: 20
  });
  console.log('Shmulik Chat Messages:', JSON.stringify(shmulikChat, null, 2));

  console.log('\n--- Checking Last Chats in Green-API ---');
  const chats = await fetchGreenApi('getChats', {});
  if (Array.isArray(chats)) {
    console.log('Recent 10 chats:');
    chats.slice(0, 10).forEach(c => console.log(c));
  }
}

run().catch(console.error);

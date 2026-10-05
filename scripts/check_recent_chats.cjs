const https = require('https');

const GREEN_ID = '710722735421';
const GREEN_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function fetchGreen(endpoint, body = null, method = 'GET') {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_ID}/${endpoint}/${GREEN_TOKEN}`,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const chats = await fetchGreen('getChats');
  console.log('Chats fetched count:', Array.isArray(chats) ? chats.length : chats);
  if (Array.isArray(chats)) {
    for (const c of chats.slice(0, 25)) {
      const history = await fetchGreen('getChatHistory', { chatId: c.id, count: 2 }, 'POST');
      let lastMsg = '';
      if (Array.isArray(history) && history.length > 0) {
        lastMsg = history[0].textMessage || history[0].extendedTextMessage?.text || `[${history[0].typeMessage}]`;
      }
      console.log(`- [${c.id}] ${c.name || 'NoName'}: ${lastMsg.substring(0, 120).replace(/\n/g, ' ')}`);
    }
  }
}
run();

const https = require('https');

const options = {
  hostname: '7107.api.greenapi.com',
  port: 443,
  path: '/waInstance710722735421/getChatHistory/ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const msgs = JSON.parse(body);
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        const text = m.textMessage || m.caption || (m.extendedTextMessage && m.extendedTextMessage.text) || '';
        console.log(`--- [${m.type}] ${m.senderName || 'Resort'} (${new Date(m.timestamp * 1000).toLocaleTimeString('he-IL')}):`);
        console.log(text);
      }
    } catch (e) {
      console.error(e, body);
    }
  });
});

req.write(JSON.stringify({ chatId: '120363409177098951@g.us', count: 12 }));
req.end();

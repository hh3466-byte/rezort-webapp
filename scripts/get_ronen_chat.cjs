const https = require('https');

const idInstance = '710722735421';
const apiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const url = `https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`;

const req = https.request(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, res => {
  let raw = '';
  res.on('data', c => raw += c);
  res.on('end', () => {
    try {
      const msgs = JSON.parse(raw);
      console.log('--- Messages with Ronen Malamud: ---');
      msgs.reverse().forEach(m => {
        const time = new Date(m.timestamp * 1000).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage || 'media');
        console.log(`[${time}] ${m.type === 'incoming' ? 'Ronen' : 'Resort'}: ${text}`);
      });
    } catch (e) {
      console.log(raw);
    }
  });
});

req.write(JSON.stringify({ chatId: '972524728843@c.us', count: 20 }));
req.end();

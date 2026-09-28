const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const id = process.env.VITE_GREEN_API_ID_INSTANCE || '7105260173';
const token = process.env.VITE_GREEN_API_API_TOKEN || 'a71e16f7ec05481788cf5d50fc19d45e64bb4c78d49a405a81';

const data = JSON.stringify({
  chatId: '972556694789@c.us',
  count: 30
});

const req = https.request({
  hostname: 'api.green-api.com',
  port: 443,
  path: `/waInstance${id}/getChatHistory/${token}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf-8');
    try {
      const msgs = JSON.parse(raw);
      console.log('Total msgs:', msgs.length);
      msgs.reverse().forEach(m => {
        const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const sender = m.type === 'outgoing' ? 'שמוליק/ריזורט' : 'אייל ברקוביץ';
        const text = m.textMessage || m.caption || (m.extendedTextMessage?.text) || '';
        console.log(`[${time}] [${sender}]: ${text}`);
      });
    } catch (e) {
      console.log('Raw response:', raw);
    }
  });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();

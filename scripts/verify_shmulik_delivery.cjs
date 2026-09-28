const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function checkLastMessages() {
  const req = https.request({
    hostname: 'api.green-api.com',
    path: `/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      try {
        const list = JSON.parse(body);
        console.log(`Retrieved ${list.length} recent messages for Shmulik (050-6336896):`);
        const latest = list.slice(0, 3);
        latest.forEach((m, idx) => {
          const time = new Date((m.timestamp || 0) * 1000).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
          const text = m.textMessage || m.extendedTextMessage?.text || '';
          console.log(`\n[${idx + 1}] Type: ${m.type}, Status: ${m.statusMessage || 'sent'}, Time: ${time}, ID: ${m.idMessage}`);
          console.log(`Snippet: ${text.slice(0, 150)}...`);
        });
      } catch (e) {
        console.error('Error parsing response:', e);
      }
    });
  });

  req.write(JSON.stringify({
    chatId: '972506336896@c.us',
    count: 3
  }));
  req.end();
}

checkLastMessages();

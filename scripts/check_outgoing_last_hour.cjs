const https = require('https');

const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const host = `${id.substring(0, 4)}.api.greenapi.com`;
const path = `/waInstance${id}/lastOutgoingMessages/${token}?minutes=60`;

https.get({ hostname: host, path: path }, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const msgs = JSON.parse(body);
      console.log('Outgoing messages in last 60 minutes:', (msgs || []).length);
      (msgs || []).slice(0, 15).forEach(m => {
        const time = new Date((m.timestamp || 0) * 1000).toLocaleTimeString('he-IL');
        console.log(`[${time}] To: ${m.chatId} | Text: ${(m.textMessage || '').substring(0, 60)}...`);
      });
    } catch (e) {
      console.error('Error parsing:', e, body);
    }
  });
});

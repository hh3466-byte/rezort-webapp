const https = require('https');

const idInstance = '710722735421';
const apiTokenInstance = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function getRecentChats() {
  const options = {
    hostname: 'api.green-api.com',
    port: 443,
    path: `/waInstance${idInstance}/getChats/${apiTokenInstance}`,
    method: 'GET'
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const chats = JSON.parse(body);
        console.log(`Total chats retrieved: ${chats.length}`);
        chats.slice(0, 15).forEach((c, idx) => {
          console.log(`[${idx+1}] ID: ${c.id} | Name: ${c.name} | NotRead: ${c.notSpamCount || 0}`);
        });
      } catch (e) {
        console.error('Error parsing:', e, body);
      }
    });
  });

  req.on('error', (e) => console.error('Req error:', e));
  req.end();
}

getRecentChats();

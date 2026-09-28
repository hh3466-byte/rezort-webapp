const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const req = https.request({
  hostname: 'api.green-api.com',
  path: `/waInstance${GREEN_API_ID}/GetChats/${GREEN_API_TOKEN}`,
  method: 'GET'
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const chats = JSON.parse(body);
      console.log('Total chats:', chats.length);
      console.log('Sample chat 0:', JSON.stringify(chats[0], null, 2));
      console.log('Sample chat 1:', JSON.stringify(chats[1], null, 2));
      console.log('Sample chat 2:', JSON.stringify(chats[2], null, 2));
    } catch (e) {
      console.error(e);
    }
  });
});
req.end();

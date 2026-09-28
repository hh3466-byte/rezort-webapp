const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const RAZ_CHAT_ID = '972543180407@c.us';

function getChatHistory() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      chatId: RAZ_CHAT_ID,
      count: 10
    });

    const options = {
      hostname: 'api.green-api.com',
      port: 443,
      path: `/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const history = await getChatHistory();
  if (Array.isArray(history)) {
    console.log(`Total messages returned: ${history.length}`);
    history.forEach((msg, idx) => {
      const date = new Date(msg.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`\n[${idx + 1}] Type: ${msg.type} | Sender: ${msg.senderName || msg.senderId} | Time: ${date}`);
      console.log(`TypeMessage: ${msg.typeMessage}`);
      console.log(`Text: ${msg.textMessage || msg.caption || '(no text)'}`);
      if (msg.statusMessage) console.log(`Status: ${msg.statusMessage}`);
    });
  }
}

main().catch(console.error);

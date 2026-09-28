const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const GROUP_ID = '120363412850948636@g.us';

function getGroupHistory() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      chatId: GROUP_ID,
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
  const history = await getGroupHistory();
  console.log('Group message history count:', Array.isArray(history) ? history.length : 0);
  if (Array.isArray(history)) {
    history.forEach((m, i) => {
      console.log(`[${i+1}] ${m.type} from ${m.senderName || m.senderId}: ${m.textMessage || m.caption || m.typeMessage}`);
    });
  }
}

main().catch(console.error);

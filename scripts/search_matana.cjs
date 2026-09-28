const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function getChats() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.green-api.com',
      port: 443,
      path: `/waInstance${GREEN_API_ID}/getChats/${GREEN_API_TOKEN}`,
      method: 'GET'
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
    req.end();
  });
}

async function searchMatana() {
  const chats = await getChats();
  console.log(`Searching across ${chats.length} chats for "מתנה"...`);
  const matches = chats.filter(c => {
    const name = c.name || '';
    return name.includes('מתנה') || name.includes('Matana') || name.includes('matana');
  });
  console.log('Matches found:', matches);
}

searchMatana();

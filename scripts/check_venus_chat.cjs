const https = require('https');

const idInstance = '710722735421';
const apiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function fetchGreenApi(endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = `https://api.green-api.com/waInstance${idInstance}/${endpoint}/${apiToken}`;
    const options = {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          resolve(raw);
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('--- Fetching chat history for Eli Kobi (972546160220@c.us) ---');
  const chatHistory = await fetchGreenApi('getChatHistory', {
    chatId: '972546160220@c.us',
    count: 100
  });
  console.log('Eli Kobi history:', JSON.stringify(chatHistory, null, 2));

  console.log('\n--- Fetching chat history for Theo (972505564073@c.us, 972545670355@c.us) ---');
  const theo1 = await fetchGreenApi('getChatHistory', {
    chatId: '972505564073@c.us',
    count: 20
  });
  console.log('Theo (Eyal) history:', JSON.stringify(theo1, null, 2));

  const theo2 = await fetchGreenApi('getChatHistory', {
    chatId: '972545670355@c.us',
    count: 20
  });
  console.log('Theo (Hadas) history:', JSON.stringify(theo2, null, 2));
}

main();

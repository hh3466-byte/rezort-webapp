const https = require('https');
const fs = require('fs');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function fetchGreenApi(endpoint, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/${endpoint}/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  const msgs = await fetchGreenApi('GetChatHistory', {
    chatId: '972506336896@c.us',
    count: 6
  });

  console.log('--- RECENT MSGS FROM SHMULIK ---');
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    console.log(`=== MSG ${i} ===`);
    console.log('type:', m.type);
    console.log('idMessage:', m.idMessage);
    console.log('typeMessage:', m.typeMessage);
    console.log('time:', new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }));
    console.log('downloadUrl:', m.downloadUrl);
    console.log('caption:', m.caption);
    console.log('textMessage:', (m.textMessage || '').substring(0, 100));

    if (m.downloadUrl) {
      const dest = `scripts/bit_proof_${i}.jpg`;
      await downloadFile(m.downloadUrl, dest);
      console.log(`Saved image to ${dest}`);
    }
  }
}

run().catch(console.error);

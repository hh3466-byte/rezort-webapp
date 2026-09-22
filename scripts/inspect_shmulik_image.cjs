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
  console.log('--- Fetching all messages in Shmulik chat ---');
  const msgs = await fetchGreenApi('GetChatHistory', {
    chatId: '972506336896@c.us',
    count: 10
  });
  
  console.log(`Found ${msgs.length} messages in Shmulik chat:`);
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    console.log(`[${i}] ${m.type} | ${new Date(m.timestamp * 1000).toISOString()} | ${m.typeMessage} | text: ${m.textMessage || m.caption || ''} | url: ${m.downloadUrl || ''}`);
  }

  // Also check if Shmulik sent to another chat or if there's any other chat with images today
  const lastMsg = msgs.find(m => m.type === 'incoming' && m.typeMessage === 'imageMessage');
  if (lastMsg && lastMsg.downloadUrl) {
    console.log('\nDownloading image from Shmulik:', lastMsg.downloadUrl);
    await downloadFile(lastMsg.downloadUrl, 'scripts/shmulik_bit_proof.jpg');
    console.log('Saved to scripts/shmulik_bit_proof.jpg');
  }
}

run().catch(console.error);

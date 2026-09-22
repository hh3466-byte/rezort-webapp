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
    count: 10
  });

  console.log('--- Checking messages from Shmulik ---');
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    console.log(`Msg ${i}: type=${m.type}, typeMsg=${m.typeMessage}, time=${new Date(m.timestamp*1000).toLocaleString('he-IL', {timeZone: 'Asia/Jerusalem'})}`);
    console.log(`  downloadUrl: ${m.downloadUrl}`);
    console.log(`  caption: ${m.caption}`);
    console.log(`  textMessage: ${m.textMessage}`);
    if (m.downloadUrl) {
      const filename = `scripts/shmulik_msg_${i}_${m.idMessage}.jpg`;
      console.log(`  Downloading to ${filename}...`);
      await downloadFile(m.downloadUrl, filename);
    }
  }

  // Also check other recent incoming messages across the entire instance
  console.log('\n--- Checking last 5 chats ---');
  const chats = await fetchGreenApi('getChats', {});
  if (Array.isArray(chats)) {
    for (const c of chats.slice(0, 5)) {
      console.log(`Chat ${c.id}: ${c.name}`);
      const hist = await fetchGreenApi('GetChatHistory', { chatId: c.id, count: 2 });
      for (const h of hist) {
        console.log(`   [${h.type}] ${h.typeMessage} at ${new Date(h.timestamp*1000).toLocaleString('he-IL', {timeZone: 'Asia/Jerusalem'})}: ${h.textMessage || h.caption || h.downloadUrl || ''}`);
      }
    }
  }
}

run().catch(console.error);

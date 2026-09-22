const https = require('https');
const fs = require('fs');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function fetchGreenApi(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/${endpoint}/${GREEN_API_TOKEN}`,
      method: method,
      headers: {
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
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
    if (postData) req.write(postData);
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
  console.log('--- Checking lastIncomingMessages ---');
  const incoming = await fetchGreenApi('lastIncomingMessages', 'GET');
  console.log(`lastIncomingMessages count: ${Array.isArray(incoming) ? incoming.length : JSON.stringify(incoming)}`);

  if (Array.isArray(incoming)) {
    for (let i = 0; i < incoming.length; i++) {
      const m = incoming[i];
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`\n[${i}] Chat: ${m.chatId} | Sender: ${m.senderName || m.senderId} | Time: ${time}`);
      console.log(`    Type: ${m.typeMessage} | Text/Caption: ${m.textMessage || m.caption || ''}`);
      console.log(`    downloadUrl: ${m.downloadUrl || ''}`);

      if (m.downloadUrl) {
        const fn = `scripts/incoming_${i}_${m.idMessage}.jpg`;
        console.log(`    Downloading to ${fn}...`);
        await downloadFile(m.downloadUrl, fn);
      }
    }
  }

  console.log('\n--- Checking Hagai Chat ---');
  const hagai = await fetchGreenApi('GetChatHistory', 'POST', { chatId: '972543200007@c.us', count: 10 });
  if (Array.isArray(hagai)) {
    console.log(`Hagai chat history (${hagai.length} msgs):`);
    for (const h of hagai) {
      console.log(`   [${h.type}] ${h.typeMessage} at ${new Date(h.timestamp*1000).toLocaleString('he-IL', {timeZone: 'Asia/Jerusalem'})}: ${h.textMessage || h.caption || h.downloadUrl || ''}`);
      if (h.downloadUrl) {
        await downloadFile(h.downloadUrl, `scripts/hagai_${h.idMessage}.jpg`);
      }
    }
  }

  console.log('\n--- Checking Hila Chat ---');
  const hila = await fetchGreenApi('GetChatHistory', 'POST', { chatId: '972526908943@c.us', count: 10 });
  if (Array.isArray(hila)) {
    console.log(`Hila chat history (${hila.length} msgs):`);
    for (const h of hila) {
      console.log(`   [${h.type}] ${h.typeMessage} at ${new Date(h.timestamp*1000).toLocaleString('he-IL', {timeZone: 'Asia/Jerusalem'})}: ${h.textMessage || h.caption || h.downloadUrl || ''}`);
      if (h.downloadUrl) {
        await downloadFile(h.downloadUrl, `scripts/hila_${h.idMessage}.jpg`);
      }
    }
  }
}

run().catch(console.error);

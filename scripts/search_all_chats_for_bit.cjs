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
  console.log('Fetching chats from Green API...');
  const chats = await fetchGreenApi('getChats', {});
  console.log(`Total chats returned: ${chats?.length || 0}`);

  const now = Date.now();
  const oneDayAgo = now - 48 * 3600 * 1000;

  for (let i = 0; i < Math.min(chats.length, 30); i++) {
    const c = chats[i];
    try {
      const msgs = await fetchGreenApi('GetChatHistory', { chatId: c.id, count: 5 });
      if (!Array.isArray(msgs)) continue;

      for (const m of msgs) {
        const msgTime = m.timestamp * 1000;
        // Check if message is recent or incoming
        if (m.type === 'incoming' || m.typeMessage === 'imageMessage' || (m.textMessage && m.textMessage.includes('ביט')) || (m.caption && m.caption.includes('ביט'))) {
          console.log(`\nChat: ${c.id} (${c.name || 'no name'})`);
          console.log(`  Msg: [${m.type}] ${m.typeMessage} at ${new Date(msgTime).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`);
          console.log(`  Sender: ${m.senderId} (${m.senderName || ''})`);
          console.log(`  Text/Caption: ${m.textMessage || m.caption || '(no text)'}`);
          console.log(`  downloadUrl: ${m.downloadUrl || ''}`);

          if (m.downloadUrl) {
            const cleanChat = c.id.replace(/[@.]/g, '_');
            const dest = `scripts/proof_${cleanChat}_${m.idMessage}.jpg`;
            console.log(`  Downloading image to ${dest}...`);
            await downloadFile(m.downloadUrl, dest);
          }
        }
      }
    } catch (e) {
      console.error(`Error checking chat ${c.id}:`, e.message);
    }
  }
}

run().catch(console.error);

const fs = require('fs');
const https = require('https');

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function getChatHistory(chatId, count = 20) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chatId, count });
    const req = https.request({
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', err => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function run() {
  const history = await getChatHistory('972528787315@c.us', 30);
  const imageMessages = history.filter(m => m.typeMessage === 'imageMessage');
  console.log(`Found ${imageMessages.length} image messages:`);
  
  for (let i = 0; i < imageMessages.length; i++) {
    const msg = imageMessages[i];
    console.log(`Image ${i+1}: ID=${msg.idMessage}, downloadUrl=${msg.downloadUrl}, caption=${msg.caption}`);
    if (msg.downloadUrl) {
      const fileName = `scripts/ayelet_transfer_${i+1}.jpg`;
      await downloadFile(msg.downloadUrl, fileName);
      console.log(`Downloaded to ${fileName}`);
    }
  }
}

run();

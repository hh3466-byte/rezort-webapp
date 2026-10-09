const https = require('https');

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function sendWhatsApp(chatId, message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chatId, message });
    const req = https.request({
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/SendMessage/${GREEN_API_TOKEN}`,
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

async function run() {
  const message = `שלום, התקבל תשלום ע״ס 2,000 ₪ מליליאן לי דלויה בעבור ליאו על שירות אילוף (מקדמה).`;

  const recipients = ["972543200007@c.us", "972506336896@c.us"];

  for (const r of recipients) {
    console.log(`Sending alert to ${r}...`);
    const resp = await sendWhatsApp(r, message);
    console.log(`Response for ${r}:`, resp);
  }
  console.log('✓ Sent updated concise message!');
}

run();

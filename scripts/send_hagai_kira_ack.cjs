const https = require('https');

const idInstance = '710722735421';
const apiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function sendMsg(chatId, message) {
  const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`;
  const postData = JSON.stringify({ chatId, message });
  
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ error: e.message, raw: data });
        }
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.write(postData);
    req.end();
  });
}

async function main() {
  const msg = `🐾 *היי חגי, טופל במלואו!* ✅

1. *קירה (ישראל מנדל)* הוחזרה מיידית לשהייה פעילה בריזורט.
2. *תשלום והארכה:* נרשם תשלום ההארכה בסך ₪600 (שולם במלואו, סה"כ ₪2,160), והשהייה הוארכה במערכת עד ה-03/10/2026 בעקבות העיכוב בשייט ומזג האוויר.
3. *מצב שוהים עדכני:* 13 כלבים שוהים כעת בריזורט.
4. *שיבוץ חדרים:* השיבוץ מעודכן ומסונכרן.`;
  
  const res = await sendMsg('972543200007@c.us', msg);
  console.log('Sent reply to Hagai:', res);
}
main();

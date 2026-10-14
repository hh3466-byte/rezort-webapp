const https = require('https');

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

const msg = `🟢 *התקבל תשלום ב-Grow לריזורט לכלב!*

👤 *שם הלקוח:* מרים אור בן חמו (שולם ע"י בן הזוג: אלון ספינדל)
🐕 *שם הכלב:* פיבי (מעורב, נקבה)
💰 *סכום ששולם:* ₪800 (תשלום מלא - 2 תשלומים של ₪400)
💳 *אמצעי תשלום:* כרטיס אשראי Grow
📞 *טלפון ליצירת קשר:* 052-2736633 (אלון: 054-5705976)
📧 *מייל:* miriam.benhamu@gmail.com
🏠 *כתובת:* יובל 10, פרדס חנה
📅 *תקופת שהות:* 15/10/2026 עד 19/10/2026 (4 לילות פנסיון)
💊 *הנחיות תרופות ומזון:* מקבלת אנטיביוטיקה פעמיים ביום עם האוכל (בוקר וערב).
📝 *הערות אופי:* לוקח לה זמן להיפתח, שומרת דיסטנס בהתחלה אבל עדינה ומתוקה.

✅ *סטטוס:* ההזמנה אושרה ושוריינה במלואה ביומן הריזורט לכלב!`;

function sendWhatsApp(chatId, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chatId, message: text });
    const options = {
      hostname: '7107.api.greenapi.com',
      port: 443,
      path: `/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`Sent to ${chatId}: HTTP ${res.statusCode}`, body);
        resolve({ status: res.statusCode, body });
      });
    });

    req.on('error', (err) => {
      console.error(`Failed to send to ${chatId}:`, err);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  // Send to Shmulik (050-6336896)
  await sendWhatsApp('972506336896@c.us', msg);
  console.log('Notification successfully delivered to Shmulik!');
}

main();

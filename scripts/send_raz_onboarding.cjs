const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const RAZ_CHAT_ID = '972543180407@c.us';

const message = `היי רז, נעים מאוד! 🐾✨

פתחנו עבורך את קהילת הוואטסאפ הרשמית של *הריזורט לכלב*, והוגדרת כמנהלת (Admin) של הקבוצה יחד עם הנהלת הריזורט! 🌿🐕

הלוגו הרשמי של הריזורט כבר עודכן כתמונת הפרופיל של הקהילה, והכל מוכן לפעילות.

🔗 *קישור ההצטרפות לקהילה לשיתוף:*
https://chat.whatsapp.com/FhBFW5Jltwa15g2OdDsWRb

---
📌 *נוסח מוצע להזמנת לקוחות להצטרף לקהילה:*

"🐶 *שלום לכל משפחת הריזורט לכלב!* 🌿
שמחים להזמין אתכם לקהילת ה-VIP הרשמית שלנו בוואטסאפ! 🐾

בקהילה נשתף:
✨ הטבות ומבצעים בלעדיים לחברי הקהילה
💡 טיפים מקצועיים מאלפים לגידול והתנהגות
📸 הצצה בלעדית לרגעים המרגשים בריזורט
🔔 עדכונים ראשונים על שריון מקומות לחגים וסופ"שים

להצטרפות קלה בלחיצה אחת:
👉 https://chat.whatsapp.com/FhBFW5Jltwa15g2OdDsWRb

נשמח לראותכם איתנו! ❤️
רז וצוות הריזורט לכלב"
---

💡 *הצעה אוטומטית:*
אנחנו יכולים להגדיר במערכת שכל לקוח שמסיים שהייה ומשתחרר מהריזורט יקבל אוטומטית הודעת תודה + הזמנה ישירה להצטרף לקהילה. מה דעתך?

מוזמנת להשיב ישירות כאן בהודעה חוזרת עם כל שאלה, רעיון או התאמה שנרצה לבצע! 😊`;

function sendWhatsAppMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      chatId: chatId,
      message: text
    });

    const options = {
      hostname: 'api.green-api.com',
      port: 443,
      path: `/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('Sending explanation message to Raz:', RAZ_CHAT_ID);
  const res = await sendWhatsAppMessage(RAZ_CHAT_ID, message);
  console.log('Send Result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);

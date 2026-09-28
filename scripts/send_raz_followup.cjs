const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const RAZ_CHAT_ID = '972543180407@c.us';

const message = `רז, עדכון קצר לגבי צירוף הלקוחות לקהילה 🐾✨

1️⃣ *צירוף אוטומטי מלא ללקוחות משתחררים:*
אנחנו משלבים את קישור ההצטרפות לקהילה ישירות בתוך הודעת סיום השהייה (בקשת חוות הדעת ושובר ה-VIP) שנשלחת אוטומטית לכל לקוח יום לאחר שחרור הכלב.
באופן הזה, כל לקוח שמסיים שהייה בריזורט יוזמן אוטומטית להצטרף לקהילה בלחיצת כפתור – 100% אוטומטי ללא שום מאמץ ידני! 🚀

2️⃣ *הנוסח ששלחנו קודם:*
הנוסח שנשלח בהודעה הקודמת מיועד במיוחד לשידור מרוכז ל*לקוחות הוותיקים* שכבר ביקרו אצלנו, כדי לחבר גם אותם לקהילה החדשה.

נשמח לשמוע מה דעתך ואיך תרצי שנערוך או נתאים את ההודעות! 😊🌿`;

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
  console.log('Sending follow-up message to Raz:', RAZ_CHAT_ID);
  const res = await sendWhatsAppMessage(RAZ_CHAT_ID, message);
  console.log('Send Result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);

const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function sendWhatsAppMessage(chatId, message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ chatId, message });
    const options = {
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`,
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

async function run() {
  const shmulikChatId = '972506336896@c.us';
  const messageText = `היי שמוליק יקר! 🐾❤️
עברתי על כל הנקודות שהעלית, הנה מענה מסודר ומדויק לכל דבר:

1. לגבי תפוסת לינה 0/16 בדוח אתמול:
הייתה תקלת טעינה רגעית של הדפדפן ששלח את הדוח שנייה לפני שסנכרן את הנתונים מהענן. ביומן הכל שמור, מעודכן ותקין ב-100%! התקלה תוקנה לחלוטין ולעולם לא תחזור.

2. ג'סי הרוטוויילרית:
עודכנה במערכת לאיסוף היום (01.10) ללא שום תוספת חיוב – מחווה שירותית ויפה באדיבות הריזורט למשפחה שנחתה בלילה. הכל מסודר.

3. סינדי:
רשומה ומעודכנת ביומן כמשתחררת היום (01.10). אתמול לא ראית אותה רק בגלל אותו דוח רגעי ששלח 0.

4. לונה מלמוד (רונן מלמוד):
הסיבה שהמערכת הציגה 20 יום היא שהתאריכים שנרשמו ביומן היו 18.09 עד 08.10 (12 יום בספטמבר + 8 יום באוקטובר = 20 יום). המערכת סופרת ימים לפי התאריכים. עשית מעולה שתיקנת ידנית למספר ימי האילוף המדויקים שסוכמו איתו!

תמונת מצב מדויקת להיום בריזורט:
🐶 שוהים כרגע: 11 כלבים
🚪 משתחררים היום: ג'סי, סינדי וטר
🐾 מחר נכנסים: בוני, יולי ובוס (אילוף)

שיהיה המשך יום מעולה ושקט בריזורט! 🐾🐕👑`;

  console.log('Sending explanation message to Shmulik (972506336896@c.us)...');
  const result = await sendWhatsAppMessage(shmulikChatId, messageText);
  console.log('Send result:', result);
}

run().catch(console.error);

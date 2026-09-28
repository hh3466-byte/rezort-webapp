const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const RAZ_CHAT_ID = '972543180407@c.us';

const message = `רז, עוד הצעה מצוינת (ולדעתנו הרבה יותר עדיפה ואפקטיבית): 💡🐾

יש לנו במערכת מאגר של כ-50 לקוחות של הריזורט (לקוחות עבר, שוהים בהווה ולקוחות עתידיים).
במקום לחכות שהם יקליקו על קישור הצטרפות, אנחנו יכולים להריץ עכשיו תהליך אוטומטי שיצרף את כל ה-50 לקוחות ישירות לתוך הקבוצה בלחיצת כפתור! 🚀

*למה זה מעולה:*
✨ הקבוצה מתמלאת מיד בחברים ומתחילה לפעול בבת אחת.
✨ אפס חיכוך – הלקוחות כבר בפנים ומוכנים לקבל את התכנים, ההטבות והעדכונים שלך.
✨ במידה וללקוח יש הגדרת פרטיות מחמירה, וואטסאפ שולח לו אוטומטית הזמנה אישית בצ'אט.

מה את אומרת? להריץ את הצירוף האוטומטי ולהכניס את כולם עכשיו לקבוצה? 😊🐕`;

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
  console.log('Sending direct auto-add suggestion to Raz:', RAZ_CHAT_ID);
  const res = await sendWhatsAppMessage(RAZ_CHAT_ID, message);
  console.log('Send Result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);

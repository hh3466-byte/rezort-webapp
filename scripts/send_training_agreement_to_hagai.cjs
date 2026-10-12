const https = require('https');

const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const text = `🐾 *הסכם האילוף הדיגיטלי של הריזורט לכלב* 📋

היי חגי, הנה הקישור הישיר לבדיקת הסכם האילוף בנייד:
👉 https://rezort-webapp.vercel.app/?agreement=training&name=%D7%97%D7%92%D7%99&phone=0543200007&dog=%D7%A8%D7%95%D7%A7%D7%99

📱 *מה תראה במסך הטלפון:*
1. 🐕 *פרטי הכלב והבעלים:* מוזנים מראש לדוגמה (חגי, רוקי, 054-3200007).
2. 📜 *נוסח ההסכם המלא והתקנון:* כל 14 הסעיפים המקצועיים של הריזורט (תנאי אילוף ופנסיון, הצהרת בריאות וחיסונים, טיפול רפואי דחוף, הגבלת אחריות ומדיניות ביטולים).
3. ✍️ *משטח חתימה דיגיטלי מלא (Touch):* חתימה חלקה עם האצבע על מסך המגע, אפשרות ניקוי וחתימה מחדש.
4. 🔒 *אבטחת גבייה:* המערכת חוסמת אוטומטית תשלום דמי אילוף מלקוח שטרם חתם על ההסכם.`;

const payload = JSON.stringify({
  chatId: '972543200007@c.us',
  message: text
});

const host = `${id.substring(0, 4)}.api.greenapi.com`;
const path = `/waInstance${id}/sendMessage/${token}`;

const req = https.request({
  hostname: host,
  path: path,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Green-API Status:', res.statusCode);
    console.log('Green-API Response:', body);
  });
});

req.on('error', err => {
  console.error('Request error:', err);
});

req.write(payload);
req.end();

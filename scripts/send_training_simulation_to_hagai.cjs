const https = require('https');

const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const targetPhone = '972543200007@c.us'; // חגי

const text = `🐾 *הריזורט לכלב – סימולציית תשלום ואילוף* 📋

היי חגי! נכנסנו לסימולציה מלאה כאילו אתה לקוח שרוצה כעת להסדיר תשלום עבור תוכנית האילוף של *רוקי* (₪6,500).

🛑 *חסימת תשלום מובנית במערכת:*
על פי נהלי הריזורט, מערכת הגבייה חוסמת באופן גורף הפקת קישור תשלום או גבייה כל עוד לא נחתם הסכם האילוף הדיגיטלי!

📝 *שלב 1 – חתימה על ההסכם:*
הנה הקישור הישיר והמותאם אישית להסכם האילוף של רוקי:
👉 https://rezort-webapp.vercel.app/?agreement=training&bookingId=b-sim-training-hagai&phone=0543200007&name=%D7%97%D7%92%D7%99&dog=%D7%A8%D7%95%D7%A7%D7%99&v=2

📱 *מה תראה ותעשה כעת במסך הטלפון:*
1. עמוד הסכם מלא ונקי ישירות בנייד (כל 14 הסעיפים, פרטי רוקי וחגי מוזנים מראש, תעריף 6,500 ₪).
2. שים לב שבראש העמוד מופיע תמרור עצור אדום: תשלום חסום עד לחתימה.
3. מלא ת.ז. ושבב, גלול לתחתית, חתום באצבע על משטח המגע ולחץ *'חתום ואשר את הסכם האילוף ✍️'*.
4. מיד עם החתימה – החסימה מוסרת, יופיע אישור ירוק וכפתור התשלום המאובטח של Grow (₪6,500) ישתחרר מיד! 💳`;

const payload = JSON.stringify({
  chatId: targetPhone,
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

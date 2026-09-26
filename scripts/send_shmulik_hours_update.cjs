const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const GREEN_API_ID = env.VITE_GREEN_API_ID || '710722735421';
const GREEN_API_TOKEN = env.VITE_GREEN_API_TOKEN || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const messageText = `היי שמוליק יקר! 🐾🐶
עדכון חשוב לגבי שעות הפעילות של הריזורט לכלב:

⏰ *שעות הפעילות המעודכנות והרשמיות:*
• *בימים א׳–ה׳:* 09:30 – 18:30 (פתיחה ב-09:30, סגירה ב-18:30)
• *בשישי וערב חג:* עד השעה 14:00 בדיוק
• *בצאת השבת / חג (למחרת השבת/חג):* פתיחה משעה 09:30

📌 *נוסח הבהרת השעות ללקוחות:*
"מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾"

✨ *מה עודכן וסונכרן במערכת?*
1. כל הודעות התשלום והשריון של Grow.
2. דף שאלון הקליטה הציבורי והתקנון (סעיף 7).
3. שובר והטבת יום כיף VIP (09:30–18:30).
4. כפתורי המענה המהיר ב-CRM (שעות פעילות, הגעה ומיקום).
5. אשף הקליטה וחלונות זמני ההגעה.
6. כל סקריפטי האוטומציה בענן.

הכל מעודכן ומסונכרן ב-100%! 🐕🤍`;

async function sendToShmulik() {
  const targetPhone = '0506336896';
  const cleanPhone = '972' + targetPhone.replace(/^0+/, '');
  const chatId = `${cleanPhone}@c.us`;

  console.log(`Sending update to Shmulik at ${chatId}...`);
  const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: messageText })
  });

  const data = await res.json();
  console.log('Response:', data);
  if (data.idMessage) {
    console.log('✓ Successfully sent to Shmulik! Message ID:', data.idMessage);
  } else {
    console.error('✗ Failed to send:', data);
  }
}

sendToShmulik().catch(console.error);

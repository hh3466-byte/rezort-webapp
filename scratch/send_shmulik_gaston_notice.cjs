const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const shmulikPhone = '972506336896@c.us';

const msg = `היי שמוליק 🐾
עדכון חשוב לגבי גסטון רנדלשטיין (הכלבה לייקה - שהייה מתוכננת 29.10 עד 01.11):

הקישור שעליו שילם גסטון מוקדם יותר היה קישור בדיקות טכני (Sandbox) – כרטיס האשראי שלו לא חויב כלל והתשלום ע"ס ₪540 לא נכנס לחשבון הגרואו של הריזורט.

אנא שים לב שלייקה עדיין לא משולמת ביומן. אנו מוציאים כעת לגסטון פנייה מסודרת עם קישור התשלום הרשמי של הגרואו להסדרת ₪540.

נעדכן מיד עם השלמת התשלום בפועל! 🐕🤍`;

async function sendShmulik() {
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: shmulikPhone, message: msg })
  });
  const data = await res.json();
  console.log('Send to Shmulik response:', data);
}

sendShmulik();

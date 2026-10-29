const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const gastonChatId = '972506280038@c.us';

const msg = `שלום גסטון! 🐾
בהמשך לשיחתנו ולהודעה הקודמת, עקב שדרוג מערכת שבוצע ברקע, הקישור הקודם שנשלח אליך לא נקלט במערכת התשלומים וכרטיסך לא חויב כלל (תוכל לוודא בקלות באפליקציית האשראי שלא ירד חיוב).

כדי לשריין סופית את המקום של לייקה בריזורט לכלב (29.10 עד 01.11), מצורף הקישור המאובטח של הריזורט:

📄 *עבור שירות:* הריזורט לכלב עבור שירות פנסיון ואירוח בתאריכים 29.10.2026 עד 01.11.2026 עבור לייקה
💰 *סכום לתשלום:* ₪540

👉 https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg

💡 *לתשלום ב-Bit, Apple Pay, Google Pay, PayBox או כרטיס אשראי:* לוחצים על הקישור ובוחרים באמצעי התשלום הנוח לך. מיד עם ביצוע התשלום מופקת קבלה וחשבונית מס אוטומטית למייל ולנייד.

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:30

בברכה חמה,
שמוליק וצוות הריזורט לכלב 🐕🤍`;

async function sendGaston() {
  console.log('Sending official payment link to Gaston:', gastonChatId);
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: gastonChatId, message: msg })
  });
  const data = await res.json();
  console.log('Green API Response:', res.status, data);
}

sendGaston();

// Native fetch in Node 24

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function sendSaar() {
  const msg = 
`היי סער! 🐾🐶
התשלום על חבילת 21 היממות הראשונה נקלט בהצלחה והכרטיסייה (מס׳ 6310) מופעלת ומאושרת במערכת! 🎉

לבקשתך, הנה הקישור לתשלום עבור *הכרטיסייה הנוספת (21 יממות נוספות בבנק הימים)* עבור ירדנה וקצח:
תוכל להסדיר את התשלום בנחת **בכל שלב עד ל-02.11.2026**, וברגע שיוסדר – 21 היממות הנוספות ייכנסו אוטומטית ישירות לבנק הימים שלכם בריזורט! 🌟

🌙 *חבילה:* 21 יממות פנסיון מלא (VIP)
💰 *סכום לתשלום:* ₪2,520 (₪120 ליממה בלבד במקום ₪180)
🎟️ *מספר כרטיסייה משוריין:* *6311*
📅 *מועד תשלום:* עד 02.11.2026 (לבקשתך)

💳 *לתשלום מאובטח בלחיצה (כולל Bit, Apple Pay, Google Pay וכרטיסי אשראי):*
👉 https://sandbox.grow.link/d6255385fd4767a58a4c28fdeb873dfb-NzUyNzY

תמיד כאן בשבילכם ולכל שאלה,
שמוליק וצוות הריזורט לכלב 🐾✨`;

  const res = await fetch(`https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: '972505716886@c.us',
      message: msg
    })
  });
  const data = await res.json();
  console.log('Send result to Saar:', data);
}

sendSaar();

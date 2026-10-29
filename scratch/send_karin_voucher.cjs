const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const chatId = '972546610321@c.us';

const msg = `שלום קארין להב! 🐾🐶
הונפקה עבורכם בהצלחה *כרטיסיית בנק 21 יממות פנסיון VIP* עבור *שון* בריזורט לכלב! 🌟

🎟️ *מספר הכרטיסייה שלכם:* *#3609*
📅 *כמות ימים בחבילה:* *21 יממות פנסיון מלא* (יתרה נוכחית: *21 יממות*)
⏳ *תוקף הכרטיסייה:* עד לתאריך *23/10/2027* (שנה מלאה)
💰 *סכום לתשלום שסוכם:* ₪2,520 (ניתן להסדיר ישירות ובמהירות ב-Bit / אשראי בקישור למטה)

🏷️ *לצפייה בכרטיסייה הדיגיטלית, ביצוע תשלום וניקוב/שריון שהיות בלחיצה:*
👉 https://rezort-webapp.vercel.app/?pass=3609

(הכלב כבר מאושר במערכת – אין צורך למלא שום שאלון מחדש!)
שמוליק וכל צוות הריזורט לכלב 🐾`;

async function send() {
  console.log('Sending pass message to Karin:', chatId);
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      message: msg
    })
  });
  const data = await res.json();
  console.log('Send response:', data);
}

send();

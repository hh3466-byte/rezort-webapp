const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const SHMULIK_CHAT_ID = '972506336896@c.us';

const message = `היי שמוליק 🐶

לגבי ההזמנה של *סקאי (קובי ברי)* שמגיע מחר ל-3 ימים:
הסיבה שהוא לא נסגר אוטומטית ביומן היא שכאשר מאשרים שאלון, ההזמנה נוצרת כברירת מחדל בסטטוס *'טרם שולם'* (מקדמה ₪0).
לפי חוקי המערכת, הזמנה נסגרת ומשובצת ביומן רק לאחר שמוזן תשלום או מקדמה (אחרת המערכת מתייחסת לזה כשריון פתוח).

💡 *איך לסמן תשלום במזומן בקלות באפליקציה לפעמים הבאות:*
1. לוחצים על ההזמנה ביומן או ברשימת ההזמנות.
2. לוחצים על אייקון התשלום (*💳*).
3. בוחרים באמצעי תשלום: *מזומן*.
4. לוחצים על *'מלא את יתרת כל החוב'* ולוחצים *שמור*.

🟢 *עדכנו את זה כבר במערכת עבורך!*
ההזמנה של סקאי עודכנה עכשיו ל-*שולם במלואו במזומן (₪360)*, והיא מופיעה מסודרת וירוקה ביומן ולקראת ההגעה מחר 🐾`;

async function send() {
  const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: SHMULIK_CHAT_ID, message })
  });
  const data = await res.json();
  console.log('Send result:', data);
}

send();

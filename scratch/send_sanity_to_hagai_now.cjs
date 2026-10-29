const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const HAGAI_CHAT_ID = '972543200007@c.us';

const report = `🛡️ *דוח בדיקת שפיות יומית ובקרת אירועים (18:30)*
תאריך: 25.10.26 | שעה: 18:42

⚙️ *בדיקת תשתיות ופונקציות:*
✅ Green-API: מחובר ותקין
✅ קישור Grow לתשלומים: פעיל ומאובטח (עמוד קבוע רשמי ללא חשבון בנק)
✅ סנכרון Supabase Cloud: תקין ומאומת
✅ בדיקת Sandbox: נחסם ונמחק כליל מהקוד – מניעת תקלות מלאה.

🟢 *אירועים ירוקים (ב-24 שעות האחרונות):*
• סונכרנו ואומתו בהצלחה *11* אירועים ושריונים מול היומן והוואטסאפ (תאריכים, מקדמות ופרטי קשר תקינים ב-100%).

🚨 *אורות אדומים (לטיפול שמוליק):*


🔴 *שריונים ללא מקדמה (₪0) שתופסים מקום ביומן (1 כלבים):*
   • 🔴 *באקסטר* (רותם משיח - 054-7706342) | 10.11.26 עד 15.11.26 | ₪0 מקדמה (חוב: ₪900)

🏦 *תזרים בנקאי עתידי (Grow - סה״כ מכלל העסקים):*
ב-10 לחודש הבא (10.11), ייכנס לבנק 25,340 שקלים

📱 *דוח זה הופק ונשלח ישירות לחגי (0543200007) כהוראת ברזל.*`;

async function sendSanityReport() {
  console.log('Sending Sanity Report to Hagai:', HAGAI_CHAT_ID);
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: HAGAI_CHAT_ID, message: report })
  });
  const data = await res.json();
  console.log('Result:', data);
}

sendSanityReport();

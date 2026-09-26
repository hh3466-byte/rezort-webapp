const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const msg = `היי שמוליק היקר! 🐾✨
שדרגנו וסידרנו עבורך במערכת מנגנון נוח במיוחד לניהול השיבוצים, שעות האכלה והשהויות בריזורט. הנה כל מה שחדש ואיך לעבוד איתו בקלות:

---

🏠 *1. לשונית "שיבוצי תאים והנחיות מיוחדות"*
שם הלשונית עודכן לנוחיותך. מעכשיו:
• *חובת שיבוץ:* כל כלב שנקלט בריזורט משובץ לתא (1 עד 11) או ל-*🏡 הלנה ביתית* (בבית שלך, עם דלי הלנה ביתית ייעודי).
• *אור אדום לכלב לא משובץ:* אם יש כלב שטרם שובץ לתא או לבית, הוא קופץ במגירה העליונה ומתריע בדוח היומי כדי שאף כלב לא יישכח.

---

✏️ *2. עריכת הזמנה מלאה בלחיצה אחת*
בלוח השיבוצים, לחיצה על כרטיס הכלב פותחת מיד את טופס ההזמנה המלא – ומאפשרת לעדכן בקלות תאריכים, חיסונים, הנחיות תזונה, תרופות והערות מיוחדות.

---

⏰ *3. מנגנון שעון אינטראקטיבי לשעות האכלה ותרופות*
במקום להקליד שעות ביד:
• *כפתורי שעות מהירות:* 08:00 (בוקר), 12:00 (צהריים), 18:00 (ערב), 20:00 (לילה).
• *שעון מובנה:* ניתן לבחור כל שעה מדויקת מהשעון ולהוסיף בלחיצה.
• *שבלונות קבועות:* 2 ארוחות ביום, 3 ארוחות, ארוחה אחת.
• *תגיות שעות נבחרות:* כל שעה מופיעה כתגית כחולה שניתן להסיר בלחיצה על ✖.

---

🎁 *4. כפתור שהות בחינם + שהות פתוחה ללא הגבלת זמן (ספציפית ללונה)*
הוספנו כפתור ייעודי *🎁 שהות בחינם (₪0)* וכפתור *♾️ שהות פתוחה ללא הגבלת זמן*.
עבור לונה (או כלב קבוע בחינם): לחיצה אחת מאפסת את המחיר והמקדמה ל-₪0, מגדירה שהות פתוחה, ומשבצת אותה בלי התראות חוב או הגבלות תאריך!

---

📊 *5. תצוגת אחוזי תפוסה ביומן*
במקום המלל "תפוסה מלאה", היומן מציג כעת ישירות ובאופן מדויק את אחוזי התפוסה (למשל: *120% תפוסה 🔴* או *80% תפוסה 🟢*).

---

הכל זמין ומעודכן לך עכשיו במערכת! מוזמן להשתמש ולהנות מזה. 🐕❤️`;

async function send() {
  const { data } = await supabase.from('settings').select('*');
  const d = data[0]?.data || {};
  const id = d.greenApiIdInstance;
  const token = d.greenApiToken;
  const chatId = '972506336896@c.us';

  console.log('Sending explanation message to Shmulik (chatId:', chatId, ')...');
  const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: msg })
  });
  const resData = await res.json();
  console.log('Send result:', resData);
}

send();

const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const messageText = `היי שמוליק יקר! 🐾
הנה עדכון קצר ומסודר על כל הנקודות שבדקנו וסידרנו עבורך במערכת:

1️⃣ *הודעות שלא נקראו ב-CRM:*
סידרנו מעכשיו שכל הודעה שאתה פותח (במחשב או בטלפון) מסומנת מיידית כנקראה והמונה מתאפס. בנוסף הוספנו כפתור ירוק מהיר: *סמן הכל כנקרא ✅*.

2️⃣ *כפתור שאלונים לבדיקה במחשב:*
איחדנו את כל הכפתורים והלשוניות למינוח אחיד: *שאלונים לבדיקה* ו-*שאלונים בתהליך*. רענון קצר במחשב (Ctrl + F5) או בנייד מעדכן את זה מיד.

3️⃣ *מיכאל בן הר ואייל ברקוביץ׳:*
• *מיכאל בן הר (חיימי):* נסע ישירות אליך ברכב במקום לסיים את הטופס – הזנו את הבקשה שלו ישירות למערכת והוא מופיע בשאלונים לבדיקה.
• *אייל ברקוביץ׳:* מילא טופס משותף ל-2 כלבים (*לולה + ברנדי*). כעת הכרטיס מציג בגדול את שניהם: *לולה + ברנדי (🐾 2 כלבים בטופס)*.

4️⃣ *יניב אלעד (החזר ₪990 על ג'נגו):*
הזיכוי ע״ס ₪990 נרשם במערכת תחת סיבת ״כלב ברח״, ויניב מחכה למענה קצר שלך ב-CRM.

שיהיה יום מבורך ומוצלח בריזורט! 🐕✨`;

async function send() {
  const chatId = '972506336896@c.us';
  console.log(`Sending message to ${chatId}...`);
  const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: messageText }),
    signal: AbortSignal.timeout(30000)
  });
  const data = await res.json();
  console.log('Response:', data);
}

send().catch(err => console.error('Send error:', err));

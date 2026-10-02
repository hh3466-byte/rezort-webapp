const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RAZ_CHAT_ID = '972543180407@c.us';

const messageToRaz = `היי רז! 🐾✨

כדי שנוכל לצאת לדרך בצורה הכי חלקה ומקצועית עם קהילת הוואטסאפ של *הריזורט לכלב*, הנה מדריך קצר, נוסח מוכן להודעת הפתיחה והנחיות לעבודה משותפת:

---

📌 *1. הודעת הפתיחה הראשונה לקהילה (הודעת ברוכים הבאים):*
זו ההודעה הראשונה שנפרסם בתוך קבוצת הקהילה כדי לקבל את פני המצטרפים ולהגדיר את ערך הקהילה:

\`\`\`
🐶 *ברוכים הבאים לקהילת ה-VIP הרשמית של הריזורט לכלב!* 🌿🐾

איזה כיף שאתם כאן איתנו! 🤍
פתחנו את הקהילה הזו במיוחד עבורכם – ההורים של הכלבים האהובים שמתארחים ומתחנכים אצלנו.

✨ *מה מחכה לכם כאן בקהילה?*
💡 *הטיפ השבועי של הריזורט:* דגשים מקצועיים מאלפי הכלבים שלנו להתנהגות נכונה, משחקי חשיבה, שגרה בריאה ותקשורת עם הכלב.
🎁 *הטבות ומבצעי VIP בלעדיים:* פינוקים, שוברי מתנה והנחות ייחודיות לחברי הקהילה בלבד.
📸 *הצצה בלעדית מאחורי הקלעים:* רגעים מיוחדים וחוויות יומיומיות מהחיים בריזורט.
🔔 *עדיפות בשריון מועדים:* פתיחה מוקדמת של שריון מקומות לחגים, חופשות וסופי שבוע לפני כולם!

🛡️ *שקט ואיכות:*
הקבוצה מנוהלת במתכונת שקטה ונקייה (הודעות רשמיות בלבד ללא ספאם), כדי לתת לכם ערך נטו.

שמחים מאוד שאתם חלק מהמשפחה שלנו! ❤️
רז וצוות הריזורט לכלב 🐾🐶
\`\`\`

---

🤖 *2. איך להתכתב ולעבוד איתי (עוזר ה-AI של הריזורט):*
אני כאן לרשותך 24/7 ישירות בצ'אט הזה! את יכולה לפנות אליי בכל רגע ולבקש:
* ✍️ **כתיבה ושדרוג טקסטים:** "תכין לי נוסח לפוסט/הודעה בנושא חרדת נטישה / הרגלי קיץ / תזונה".
* 💡 **רעיונות לפעילויות והטבות:** "תן לי 3 רעיונות להטבות חודשיות לחברי הקהילה".
* ✏️ **עריכה והתאמה:** פשוט תזרקי לי טיוטה או רעיון כללי, ואני אערוך אותו לנוסח מלוטש, מעוצב ומניע לפעולה.
* ⚙️ **הנחיות לאוטומציה:** כל בקשה שתשלחי כאן נקלטת ומטופלת ישירות במערכת.

---

⏰ *3. תיאום תזכורת להודעה השבועית:*
מתי הכי נוח לך לקבל תזכורת שבועית להודעה/טיפ לקהילה?
(למשל: **יום ראשון ב-10:00 בבוקר** / **יום רביעי ב-16:00 לקראת סופ"ש** / או כל יום ושעה אחרים שמתאימים לך?)

ברגע שתכתבי לי מתי נוח לך, אכוון את המערכת לשלוח לך תזכורת אוטומטית עם רעיון וטיוטה מוכנה בכל שבוע! 🎯

מחכה לתשובתך ושתהיה לנו דרך מעולה ופורה יחד! 🐶🌿`;

async function send() {
  console.log('Fetching GreenAPI credentials from Supabase...');
  const { data: rows } = await supabase.from('settings').select('*').limit(1);
  const s = rows?.[0]?.data || {};
  const id = s.greenApiIdInstance;
  const token = s.greenApiToken;

  if (!id || !token) {
    console.error('Missing GreenAPI credentials in settings!');
    return;
  }

  console.log('Sending message to Raz at:', RAZ_CHAT_ID);
  const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: RAZ_CHAT_ID, message: messageToRaz })
  });

  const resData = await res.json();
  console.log('Response from Green-API:', resData);
}

send();

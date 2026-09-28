const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const RAZ_PHONE = '0543180407';
const RAZ_CHAT_ID = '972543180407@c.us';

const msgToRaz = `היי רז! שמחים מאוד על האישור שלך לגבי הקהילה 🐾✨

כדי שהכל יעבוד חלק ומקצועי, נשמח לעזרתך בניסוח שתי הודעות:

---
📌 *משימה 1: ניסוח הודעה ללקוחות העבר (שכבר השתחררו בעבר):*
נוסח אישי וחם שנשלח לכל הלקוחות הוותיקים של הריזורט, שמודיע להם שאנחנו מצרפים אותם לקהילת ה-VIP החדשה של הריזורט בוואטסאפ (עם הסבר קצר על היתרונות, טיפים מאלפים והטבות).

---
📌 *משימה 2: שדרוג הודעת סיום שהייה ללקוחות שמשתחררים מעתה והלאה:*
אנחנו רוצים שכל לקוח שישתחרר מעכשיו יקבל אוטומטית למחרת השחרור (במועד שליחת בקשת חוות הדעת ושובר ה-VIP) גם הזמנה רשמית להצטרפות לקהילה!

הנה *ההודעה הקיימת* שנשלחת כיום למשתחררים:
\`\`\`
היי {שם הלקוח} 😊
שמחנו ממש לארח את {שם הכלב} אצלנו בריזורט לכלב! 🐾🤍
איך {שם הכלב} התאקלם בחזרה בבית? התגעגענו אליו כבר!

💎 מעכשיו אתם רשמית חלק ממועדון ה-VIP של הריזורט לכלב!
באירוח הבא שלכם (3 ימים ומעלה), יחכה לכם פינוק VIP מתנה לבחירתכם:
✨ 100 ₪ הנחה ישירה
✨ יום כיף ושהות יומית VIP מתנה (09:30–18:30)
✨ סשן משחקי חשיבה והעשרה מנטלית (Brain Games)
✨ ספא חפיפה, פתיחת קשרים ובישום יוקרתי
✨ צ'ק אאוט מאוחר מוארך עד 18:30
✨ מארז שף גורמה: עצם לעיסה טבעית מעושנת ומעדני בריאות

⏰ שימו לב: תוקף שובר ה-VIP הינו ל-3 חודשים בלבד מיום השחרור!

🤝 רוצים לפנק חברים עם כלב?
שתפו אותם בהודעה הזו – הם ייהנו מ-100 ₪ הנחה לשהות ראשונה (תוקף ל-3 חודשים), ואתם תצברו 100 ₪ הנחה לשהות הבאה שלכם!

נשמח מאוד אם תפרגנו לנו בכמה מילים על החוויה שלכם:
⭐ ביקורת בגוגל: https://maps.app.goo.gl/G31uwaQXP6Ln5myX9
👍 פייסבוק: https://www.facebook.com/profile.php?id=61576998315714&sk=reviews
📸 אינסטגרם: https://www.instagram.com/dogz.resort/

מחכים לראותכם שוב!
שמוליק וצוות הריזורט לכלב 🐾🐶
\`\`\`

---
✨ *מה שצריך לעשות:*
נשמח שתעברי על הנוסח הקיים, תשלבי בו את ההזמנה לקהילה בצורה הכי נכונה, ותעבדי גם על הנוסח ללקוחות העבר. 
ברגע שתשלחי לנו לכאן את הנוסחים הסופיים – נטמיע אותם מיד באוטומציה של המערכת! 

תודה רבה ולילה טוב 🙏🌿`;

async function send() {
  const { data: rows } = await supabase.from('settings').select('*').limit(1);
  const s = rows?.[0]?.data || {};
  const id = s.greenApiIdInstance;
  const token = s.greenApiToken;

  console.log('Sending copywriting request to Raz:', RAZ_CHAT_ID);
  const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: RAZ_CHAT_ID, message: msgToRaz })
  });
  const resData = await res.json();
  console.log('Result:', resData);
}

send();

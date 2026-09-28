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
const RAZ_CHAT_ID = '972543180407@c.us';

const msgToRaz = `רז, חידוד והדגשה סופר-חשובה מחגי לגבי הניסוח: 💡🐾

אנחנו *לא* מעוניינים לשלוח ללקוחות לינקים ולבקש מהם להצטרף.
אנחנו *מצרפים אותם אוטומטית וישירות לתוך הקבוצה*, ומי שלא מעוניין – פשוט יכול לפרוש בכל עת! 🚀

לכן, הניסוח בשתי ההודעות (גם ללקוחות העבר וגם בהודעת סיום השהייה למשתחררים) צריך להיות מנוסח בהתאם:
*"צירפנו אתכם לקהילת ה-VIP הרשמית של הריזורט לכלב..."* (עם הסבר קצר על הערך, ההטבות והטיפים שיקבלו, וציון שמי שפחות מתאים לו יכול לפרוש בכל שלב).

מבחינה טכנולוגית – המערכת שלנו כבר מוגדרת להוסיף אותם פיזית ישירות לקבוצה בוואטסאפ במעמד השחרור/השליחה!

מחכים לנוסחים המעודכנים שלך כדי להטמיע הכל במערכת 🙏🌿`;

async function send() {
  const { data: rows } = await supabase.from('settings').select('*').limit(1);
  const s = rows?.[0]?.data || {};
  const id = s.greenApiIdInstance;
  const token = s.greenApiToken;

  console.log('Sending direct add clarification to Raz:', RAZ_CHAT_ID);
  const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: RAZ_CHAT_ID, message: msgToRaz })
  });
  const resData = await res.json();
  console.log('Result:', resData);
}

send();

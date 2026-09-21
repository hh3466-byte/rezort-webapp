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

const msg = `היי שמוליק היקר! 🐾
ראינו את צילום המסך ששלחת, הנה בדיוק מה שקרה:

🔍 *מה קרה בתמונה?*
כשפתחת את החלון בטלפון, המקלדת של הטלפון קפצה אוטומטית והסתירה את כל החלק התחתון של המסך.
בתחתית המסך חיכה הכפתור הירוק של השליחה, אבל בגלל שהמקלדת כיסתה אותו – לא ראית אותו ולא ידעת שצריך ללחוץ עליו כדי לשלוח!

🛠️ *מה סידרנו ושיפרנו לך עכשיו במערכת:*
1. *המקלדת כבר לא קופצת לבד* – כשתפתח את החלון, המקלדת תישאר למטה והמסך יישאר פתוח ונקי מול העיניים.
2. *כפתור ירוק ענק ונעוץ בתחתית* – בתחתית המסך מופיע כעת תמיד כפתור ירוק גדול, בולט ונוח לאגודל:
👉 *⚡ שלח קישור בוואטסאפ*

📱 *איך שולחים מעכשיו בקלות?*
פשוט לוחצים על הכפתור הירוק הגדול – והקישור נשלח מיד ללקוח בוואטסאפ ברקע בלי להסתבך!

מוזמן לרענן את העמוד בטלפון ולראות איך זה עובד חלק! 🐕✨`;

async function send() {
  const { data } = await supabase.from('settings').select('*');
  const d = data[0]?.data || {};
  const id = d.greenApiIdInstance;
  const token = d.greenApiToken;
  const chatId = '972506336896@c.us';

  console.log('Sending message to Shmulik (chatId:', chatId, ')...');
  const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: msg })
  });
  const resData = await res.json();
  console.log('Send result:', resData);
}

send();

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

const messageText = `היי שמוליק יקר, ערב טוב! 🐾

בדקנו את הודעות הניתוק של הגרין-איי-פי-איי – *הוואטסאפ שלך כרגע מחובר, פעיל ומסונכרן באופן תקין לחלוטין!* 🟢

ההודעות שמתקבלות לעיתים נובעות מכך שהטלפון (מערכת האנדרואיד) "מרדים" את הוואטסאפ ברקע כדי לחסוך סוללה כשהמסך כבוי, מה שגורם לניתוקים רגעיים.

כדי למנוע את התופעה ולשמור על חיבור יציב ורציף 24/7, בצע בבקשה *3 צעדים פשוטים בטלפון (דקה אחת בלבד)*:

---

🔋 *שלב 1: ביטול הגבלת סוללה לוואטסאפ*
1. היכנס בטלפון ל-**הגדרות** ➔ **יישומים (Apps)** ➔ בחר ב-**WhatsApp**.
2. לחץ על **סוללה (Battery)**.
3. שנה מ-"מותאם" (Optimized) ל-👉 **"ללא הגבלה" (Unrestricted)**.

📶 *שלב 2: אישור נתונים ברקע*
1. באותו מסך של WhatsApp, לחץ על **נתונים ניידים (Mobile Data)**.
2. ודא שהאפשרות **"אפשר שימוש בנתוני רקע"** מופעלת (דלוקה בכחול).

🔒 *שלב 3: נעילת הוואטסאפ בזיכרון (שלא ייסגר ב"סגור הכל")*
1. פתח את מסך היישומים הפתוחים בטלפון (לחיצה על 3 הפסים / הריבוע בתחתית המסך).
2. לחץ לחיצה ארוכה (או לחץ על האייקון של WhatsApp בראש החלון).
3. בחר 👉 **"נעל אפליקציה זו" / "השאר פתוח" (Lock / Keep Open)**.
   *(יופיע סמל מנעול קטן מעל האפליקציה).*

---

ברגע שתגדיר זאת, הוואטסאפ יישאר פעיל ורציף ברקע ולא יקפצו יותר התראות ניתוק! 🚀🐾`;

async function sendToShmulik() {
  const { data } = await supabase.from('settings').select('*');
  const d = data[0]?.data || {};
  const id = d.greenApiIdInstance || '710722735421';
  const token = d.greenApiToken || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  const chatId = '972506336896@c.us';
  const url = `https://api.green-api.com/waInstance${id}/sendMessage/${token}`;

  console.log('Sending settings guide to Shmulik at', chatId, '...');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: messageText })
  });

  const respData = await res.json();
  console.log('Response:', respData);
}

sendToShmulik().catch(console.error);

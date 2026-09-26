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

const msg = `היי שמוליק היקר! 🐾🐶
עדכנו ושדרגנו את המערכת בדיוק לנוחות המקסימלית שלך – הנה הסבר קצר וברור על העדכון:

✨ *1. שינוי שם ופיצול "פעילות יומית":*
השם של שירות "אילוף ביומיות" שונה ל-*פעילות יומית*, וכעת הוא מפוצל לשני שירותים ברורים:
• *אילוף ביומיות:* ₪250 ליום.
• *שהייה יומית בריזורט (מעון יום / Daycare):* ₪90 ליום ברירת מחדל (ניתן לעריכה לפי הצורך).

🎟️ *2. הנפקת כרטיסיות מראש (תוקף לחצי שנה):*
נוסף כפתור חדש בסרגל העליון: *🎟️ כרטיסיות פעילות יומית*.
• ניתן להנפיק כרטיסיית ימים (5, 10, 15, 20 או כמות מותאמת אישית).
• ניתן לערוך את המחיר הכולל.
• לכל כרטיסייה מונפק מספר מספרי פשוט (למשל: *8492*), והיא תקפה לחצי שנה.

📱 *3. איך הלקוח משריין יום הגעה (בלי להעמיס עליך בוואטסאפ)?*
• בלחיצה על כפתור השליחה בכרטיסייה, הלקוח מקבל הודעה עם מספר הכרטיסייה שלו וקישור ישיר לטופס דיגיטלי.
• בכל פעם שהלקוח רוצה להביא את הכלב, הוא נכנס לקישור ומגיש בקשה קצרה לתאריך המבוקש (הטופס מוגדר אוטומטית כ-₪0 תשלום).

📥 *4. איך אתה קולט את הכלב ליומן?*
• הבקשה נכנסת אליך ישירות למסך *שאלונים לבדיקה* עם תג ירוק בולט:
👉 *🎟️ כרטיסיית פעילות יומית (ללא תשלום)*
• אתה לוחץ על *קלוט ליומן הראשי 🟢* – והמערכת מכניסה את הכלב ליומן ומקזזת אוטומטית יום 1 מיתרת הכרטיסייה בענן!

הכל פועל חלק, אוטומטי ושומר על הזמן שלך נקי מהתכתבויות מיותרות! 🐕🤍`;

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

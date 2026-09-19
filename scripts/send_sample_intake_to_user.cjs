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

async function send() {
  const { data } = await supabase.from('settings').select('*');
  const s = data && data[0] ? (data[0].data || data[0]) : {};
  const id = s.greenApiIdInstance || '710722735421';
  const token = s.greenApiToken || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  const text = `🐾 *הריזורט לכלב – דוגמה לשאלון הקליטה עם שדה כתובת המגורים וזיהוי GPS* 📍

שלום חגי! לבקשתך, הנה קישור ישיר לשאלון הקליטה בדיוק כפי שהלקוח רואה אותו בטלפון:
👉 https://rezort-webapp.vercel.app/?intake=true&phone=0543200007&name=%D7%97%D7%92%D7%99

🌟 *מה הוטמע ואיך הלקוח חווה את זה:*
1. 🏠 *שדה כתובת מגורים מלאה (שדה חובה):*
הלקוח מחויב להזין עיר, רחוב ומספר בית. מוצג הסבר ברור שהפרט נועד לשמירה על ביטחון הכלב וחילוץ מהיר במקרי חירום (טבע הכלב לרוץ הביתה).

2. 📍 *כפתור זיהוי כתובת ב-GPS:*
כפתור מעוצב: *"זהה כתובת ב-GPS 📍"*. בלחיצה אחת, הדפדפן ממיר את המיקום ישירות לשם רחוב, מספר ועיר בעברית!

3. 🔄 *לקוח ותיק שהחליף כתובת:*
לקוח מוכר מקבל זיהוי עם הודעה ברורה: *"זוהתה כתובת משהות קודמת... עברתם דירה? לחצו לעדכון כתובת ✏️"*. השדה נשאר פתוח לחלוטין לעריכה או עדכון מחדש ב-GPS, והכתובת המעודכנת נשמרת אוטומטית במערכת.

4. 🚗 *ניווט חירום לצוות ב-Waze:*
בכרטיסי הכלבים ביומן הוטמע כפתור ישיר *"נווט לבית הכלב ב-Waze"* לפתיחת מסלול מיידי ברגעי חירום.`;

  const url = `https://api.green-api.com/waInstance${id}/sendMessage/${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: '972543200007@c.us',
      message: text
    })
  });

  const resp = await res.json();
  console.log('Green-API response:', resp);
}

send().catch(console.error);

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

  const text = `🐾 *הריזורט לכלב – שאלון הקליטה המעודכן עם כתובת ו-GPS* 📍

שלום חגי! הגרסה המעודכנת עלתה כעת לשרת:
👉 https://rezort-webapp.vercel.app/?intake=true&phone=0543200007&name=%D7%97%D7%92%D7%99

🌟 *איך הלקוח חווה את זה (חלק סטנדרטי ושגרתי לחלוטין):*
1. 🏠 *כתובת מגורים (שדה חובה):*
השדה מופיע בצורה חלקה וטבעית בחלק של פרטי הבעלים: *"כתובת מגורים (עיר, רחוב ומספר בית)"* – ללא שום אזכור של חירום או בריחה, בדיוק כמו בכל טופס רישום סטנדרטי.

2. 📍 *זיהוי כתובת בלחיצה אחת (GPS):*
לצד השדה מופיע כפתור ירוק: *"זהה כתובת ב-GPS 📍"*. בלחיצה אחת הכתובת מזוהה ישירות בעברית וממלאת את השדה בלי להקליד.

3. 🔄 *לקוח ותיק שהחליף כתובת:*
לקוח מוכר מקבל תיוג נעים של הכתובת הקודמת עם אפשרות מהירה: *"עברתי דירה / עדכן כתובת ✏️"*, או זיהוי מחדש ב-GPS, והכתובת המעודכנת נשמרת אוטומטית במערכת!`;

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

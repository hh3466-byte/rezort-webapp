const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const cleanId = GREEN_API_ID.replace(/\D/g, '');
const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
const domain = clusterPrefix ? clusterPrefix + '.api.greenapi.com' : 'api.greenapi.com';
const url = `https://${domain}/waInstance${cleanId}/sendMessage/${GREEN_API_TOKEN}`;

const link = 'https://rezort-webapp.vercel.app/?request=true&name=' + encodeURIComponent('חגי הילמן') + '&phone=0543200007&dog=' + encodeURIComponent('טופי');

const text = `היי חגי! 🐾
לבקשתך, להלן קישור ישיר לשאלון הקליטה הדיגיטלי החדש והמשודרג:

👉 ${link}

✨ *מה חדש בשאלון:*
1. 🛡️ *באדג' והסבר בריאותי וטרינרי:* הוסר כל אזכור של בריחה, והדגש הוא על תיק רפואי, ביטוח ובטיחות וטרינרית.
2. 📍 *כפתור GPS בולט ומעוצב עם תג "מומלץ ⭐":* לחיצה עליו מזהה וממלאת אוטומטית את הכתובת המדויקת של הלקוח.
3. 🏙️ *השלמה אוטומטית (Autocomplete):* של כל ערי ויישובי ישראל תוך כדי הקלדה.

בברכה,
שמוליק וצוות הריזורט לכלב 🐕🤍`;

async function send() {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: '972543200007@c.us',
      message: text
    })
  });
  const resJson = await resp.json();
  console.log('Green API Response:', resJson);
}

send();

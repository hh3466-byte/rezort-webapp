const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function sendConfirmationToUser() {
  // 1. Update settings with Green-API credentials if missing
  const { data: sData } = await supabase.from('settings').select('*').limit(1);
  if (sData && sData[0]) {
    const s = sData[0];
    const extra = s.extra_data || {};
    if (!extra.greenApiIdInstance) {
      extra.greenApiIdInstance = GREEN_API_ID;
      extra.greenApiToken = GREEN_API_TOKEN;
      await supabase.from('settings').update({ extra_data: extra }).eq('id', s.id);
      console.log('Saved Green-API credentials to Supabase settings.');
    }
  }

  // 2. Prepare the confirmation message with the location link
  const message = `שלום! 🐾
שמחים לעדכן כי המקום עבור *ספסוף* שוריין בהצלחה בהריזורט לכלב!

📋 *פרטי ההזמנה לדוגמה:*
🐕 *שם הכלב:* ספסוף (מעורב)
🌟 *שירות:* פנסיון לילה 🌙
📅 *תאריכים:* 14/09/2026 עד 16/09/2026
💵 *סה״כ עלות:* ₪360
✅ *מקדמה ששולמה:* ₪100
💳 *יתרה לתשלום בעת הקליטה:* ₪260

⏰ *שעות קבלה ושחרור:*
• ימים א׳–ה׳: 09:00–19:00
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:00
• מעבר לשעות הפעילות (לפני 09:00 ואחרי 19:00), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

אנא וודאו כי פנקס החיסונים בתוקף וציידו את ספסוף במזון הרגיל ובמידת הצורך בציוד אישי.

📍 *מיקום והגעה בריזורט לכלב (Waze / Google Maps):*
https://maps.app.goo.gl/8bm2Rdt7DtHeUS5J9

מחכים לכם! צוות הריזורט לכלב 🐾 (054-8765888)`;

  // 3. Send via Green-API to 0543200007
  const targetPhone = '0543200007';
  const cleanPhone = '972' + targetPhone.replace(/^0+/, '');
  const chatId = `${cleanPhone}@c.us`;

  const sendUrl = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
  console.log(`Sending confirmation message to ${chatId}...`);

  const response = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      message
    })
  });

  const result = await response.json();
  console.log('Send result:', result);
  return result;
}

sendConfirmationToUser();

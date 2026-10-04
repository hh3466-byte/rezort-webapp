const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

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

const targetPhone = '050-7900781';
const cleanPhone = '972507900781';
const chatId = `${cleanPhone}@c.us`;
const lockedLink = 'https://sandbox.grow.link/3681451075e8b661a07f3d2e40f47b7b-NzIwMzU';

const messageText = `היי ניבה, אין שום בעיה! 🐾🐶
בשמחה רבה – מעדכנים עבורך מקדמת שריון בסך *₪360 בלבד* (₪180 לכלב) לשריון המקום עבור *שטוץ וכלב נוסף* בין התאריכים 02/02/2027 עד 18/02/2027. את יתרת התשלום (₪3,420) ניתן להסדיר בנוחות בכניסה לריזורט.

להסדרת המקדמה המאובטחת (הסכום ₪360 נעול וסגור לתשלום):
👉 ${lockedLink}

💡 *לתשלום ב-Bit, Apple Pay, Google Pay או כרטיס אשראי:* פשוט לוחצים על הקישור ובוחרים באמצעי התשלום הרצוי (נקלט ומעדכן אוטומטית עם קבלה מיידית!).

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:30
• מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

בברכה חמה,
שמוליק וצוות הריזורט לכלב 🐕🤍`;

async function sendNow() {
  console.log(`Sending locked ₪360 payment link message to ${chatId}...`);
  
  const sendUrl = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
  const response = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: chatId,
      message: messageText
    })
  });

  const result = await response.json();
  console.log('Green API Response:', response.status, result);

  if (response.ok && result.idMessage) {
    console.log(`✅ Locked link message sent successfully! Message ID: ${result.idMessage}`);

    // Update intake request in Supabase with depositRequested = 360
    const { data: settingsData } = await supabase.from('settings').select('*');
    if (settingsData && settingsData[0]) {
      const s = settingsData[0];
      if (s.data && s.data.intakeRequests) {
        const req = s.data.intakeRequests.find(r => r.id === 'req-1791102597766' || JSON.stringify(r).includes('7900781'));
        if (req) {
          req.depositRequested = 360;
          req.paymentUrl = lockedLink;
          req.status = 'payment_requested';
          req.updatedAt = new Date().toISOString();
          req.internalNotes = 'שמוליק קבע מחיר סופי של ₪3,780. נשלחה מקדמה סגורה של ₪360 (₪180 לכלב). יתרה ₪3,420 בכניסה.';
          await supabase.from('settings').update({ data: s.data, updated_at: new Date().toISOString() }).eq('id', s.id);
          console.log('✅ Supabase intake request updated with ₪360 deposit.');
        }
      }
    }
  }
}

sendNow().catch(err => console.error('Error:', err));

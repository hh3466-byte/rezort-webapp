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

const messageText = `היי ניבה, שמחנו לשוחח! 🐾🐶
שמחים לעדכן שהמקום עבור *שטוץ וכלב נוסף* נשמר בריזורט לכלב בין התאריכים 02/02/2027 עד 18/02/2027 (סכום מוסכם: ₪3,780).
להשלמת השריון, יש ללחוץ על הקישור המאובטח לתשלום (בסך ₪3,780):
👉 https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg

💡 *לתשלום ב-Bit, Apple Pay, Google Pay, PayBox או כרטיס אשראי:* פשוט לוחצים על הקישור למעלה ובוחרים באמצעי התשלום הרצוי (התשלום נקלט ומעדכן את המערכת אוטומטית עם קבלה וחשבונית מס מיידית למייל ולטלפון!).

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:30
• מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

בברכה חמה,
שמוליק וצוות הריזורט לכלב 🐕🤍`;

async function sendNow() {
  console.log(`Sending payment link message to ${chatId} (${targetPhone})...`);
  
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
    console.log(`✅ Message sent successfully! Message ID: ${result.idMessage}`);

    // Update settings in Supabase to record updated timestamp and status
    const { data: settingsData } = await supabase.from('settings').select('*');
    if (settingsData && settingsData[0]) {
      const s = settingsData[0];
      let updated = false;
      if (s.data && s.data.intakeRequests) {
        const req = s.data.intakeRequests.find(r => r.id === 'req-1791102597766' || JSON.stringify(r).includes('7900781'));
        if (req) {
          req.status = 'payment_requested';
          req.updatedAt = new Date().toISOString();
          req.lastPaymentLinkSentAt = new Date().toISOString();
          updated = true;
        }
      }
      if (updated) {
        await supabase.from('settings').update({ data: s.data, updated_at: new Date().toISOString() }).eq('id', s.id);
        console.log('✅ Supabase intake request updated.');
      }
    }
  } else {
    console.error('❌ Failed to send message via Green API:', result);
  }
}

sendNow().catch(err => console.error('Error:', err));

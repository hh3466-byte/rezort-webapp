const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MANAGER_CHAT_ID = '972543200007@c.us';

const sampleMessage = `📲 *דוגמה להודעת בקשת תשלום ושריון מקום (הריזורט לכלב)*

היי ישראל! 🐾
שמחים לעדכן שהמקום עבור *מקס* (פנסיון 🏨) שוריין בריזורט לכלב לתאריכים:
📅 10.10.26 עד 15.10.26.

💰 *הסכום לתשלום:* ₪750

להשלמת השריון והסדרת התשלום, יש ללחוץ על הקישור המאובטח:
👉 https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg

💡 *לתשלום ב-Bit, Apple Pay או אשראי:* פשוט לוחצים על הקישור למעלה ובוחרים באמצעי התשלום הרצוי (התשלום נקלט אוטומטית עם קבלה ואישור מיידיים למייל ולטלפון!).

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:30
• מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

נשמח לראותכם בריזורט! 🐕🤍
צוות הריזורט לכלב`;

async function sendSample() {
  const { data: rows } = await supabase.from('settings').select('*').limit(1);
  const s = rows?.[0]?.data || {};
  const id = s.greenApiIdInstance;
  const token = s.greenApiToken;

  if (!id || !token) {
    console.error('Missing GreenAPI credentials');
    return;
  }

  console.log('Sending sample payment message to Manager:', MANAGER_CHAT_ID);
  const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: MANAGER_CHAT_ID, message: sampleMessage })
  });

  const resData = await res.json();
  console.log('Result:', resData);
}

sendSample();

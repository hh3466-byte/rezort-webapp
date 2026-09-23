const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SHMULIK_CHAT_ID = "972506336896@c.us";

async function sendShmulikKarinExplanation() {
  const { data: settingsRows } = await supabase.from('settings').select('*');
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };

  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;

  if (!greenId || !greenToken) {
    console.error('Missing GreenAPI credentials');
    return;
  }

  const messageText = `היי שמוליק יקר! 🐾
עדכון חשוב ומסודר לגבי ההזמנה והתשלום של *קארין להב (הכלב שון)*:

📌 *מה שקרה:*
קארין שילמה ₪440 ב-Bit דרך Grow ב-21.09 (עבור 3 לילות בניכוי הטבת מועדון VIP בסך 100 ₪).
בגלל שהייתה לה הזמנה קודמת משבוע שעבר (17-18.09), מערכת הסליקה הצמידה בטעות את התשלום של ה-440 ₪ לשהות הישנה ולא פתחה שורת הזמנה חדשה ביומן לתאריכים של השבוע הנוכחי.

✅ *מה תוקן וסודר ביומן עכשיו:*
1. **ההזמנה הקודמת (17-18.09):** הוחזרה לסכומה המקורי (₪180 ששולמו).
2. **הוזנה הזמנה חדשה ומאושרת ביומן:**
   • 🐶 *שם הכלב:* שון (מעורב)
   • 👤 *בעלים:* קארין להב (054-6610321)
   • 📅 *תאריכים:* 22.09.26 עד 25.09.26 (הגיע ב-22.09, איסוף צפוי מחר 24.09 בערב)
   • 💳 *תשלום:* **₪440 שולמו במלואם** (Bit, אסמכתא 175543879)
   • 🟢 *סטטוס:* מאושר ומשולם במלואו ביומן.

🛡️ *שדרוג המערכת שהוטמע למניעת הישנות:*
המערכת שודרגה כך שברגע שלקוח חוזר משלם עבור שהות חדשה – התשלום לעולם לא ייצמד להזמנת עבר שהסתיימה, והמערכת תפתח אוטומטית שורת הזמנה חדשה ביומן על פי התאריכים העדכניים של שאלון הקליטה!

המשך ערב מעולה ושקט! ❤️🐶🐾`;

  console.log('Sending message to Shmulik:', SHMULIK_CHAT_ID);
  const sendRes = await fetch(`https://api.green-api.com/waInstance${greenId}/sendMessage/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: SHMULIK_CHAT_ID, message: messageText })
  });

  const resJson = await sendRes.json();
  console.log('Send response:', resJson);
}

sendShmulikKarinExplanation().catch(console.error);

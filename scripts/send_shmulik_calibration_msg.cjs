const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const SHMULIK_CHAT_ID = '972506336896@c.us';

async function sendShmulikUpdate() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  const msg = `בוקר טוב שמוליק! 🐾✨
עברנו הבוקר ביסודיות על כל הנקודות וההערות שהעלית וביצענו כיול מקיף למערכת:

1. *תוקן באג ספירת התפוסה בדוחות* – הוסרה הכפלת הזוגות הישנה, וכעת ספירת הכותרת תואמת בדיוק לרשימת הכלבים (14 כלבים בסוף היום).
2. *קובעו כל שיבוצי החדרים וההלנה הביתית* – והוסרו התראות שיבוץ מוקדמות על כלבים שטרם הגיעו למתחם.
3. *סונכרנו כל ההסדרים הכספיים* – טוני, מייק, קאיה, קירה והמקדמה של בוס עודכנו במלואם.

אם אתה מבחין בפערים או אי-דיוקים נוספים בשטח, תציף אותם חופשי כדי שנמשיך לכייל ולדייק את המערכת עד לרמת הפרט הקטן ביותר.

שיהיה יום מעולה וסוף שבוע שקט בריזורט! 🐕🤍`;

  console.log(`Sending message to Shmulik (${SHMULIK_CHAT_ID})...`);
  const res = await fetch(`https://api.green-api.com/waInstance${greenId}/sendMessage/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: SHMULIK_CHAT_ID,
      message: msg
    })
  });

  const data = await res.json();
  console.log('Send result:', data);
}

sendShmulikUpdate().catch(console.error);

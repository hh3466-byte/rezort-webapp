const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function sendCommunityWelcome() {
  const { data: s } = await supabase.from('settings').select('*').limit(1).single();
  const idInstance = s?.green_api_id_instance || '710722735421';
  const apiToken = s?.green_api_token || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  
  const communityChatId = '120363412850948636@g.us';
  const messageText = `🐾 *ברוכים הבאים לקהילת ה-VIP הרשמית של הריזורט לכלב!* 🐶✨

איזה כיף שאתם כאן איתנו בבית החם של הכלבים שלכם! ❤️

הקמנו את הקהילה הזו כדי לייצר עבורכם מרחב שקט, איכותי ומכבד (בלי חפירות, בלי ספאם ובלי הודעות מיותרות) שבו תקבלו:

✨ *עדיפות ראשונה בהזמנת מקומות:*
שריון מקום מובטח לחגים, חופשות וסופי שבוע לפני כולם.

💡 *טיפים מקצועיים ויישומיים:*
דגשים חשובים מאלפים מוסמכים לגידול נכון, פריקת אנרגיה, התנהגות ותזונה.

🎁 *הטבות בלעדיות לחברי הקהילה:*
מבצעים, הטבות עונתיות והפתעות ששמורות רק לחברי הקבוצה.

📸 *רגעים יפים ומרגשים מהריזורט:*
תמונות, סרטונים וחוויות משמחות מחיי היום-יום של הכלבים בריזורט.

אנחנו כאן תמיד באהבה ענקית, בשבילכם ובשביל הכלבים האהובים שלכם! 🐕🤍
*שמוליק, רז וכל צוות הריזורט לכלב 🐾*`;

  console.log('Sending message to Green API community chat:', communityChatId);
  const url = `https://7107.api.greenapi.com/waInstance${idInstance}/sendMessage/${apiToken}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: communityChatId,
      message: messageText
    })
  });
  
  const result = await res.json();
  console.log('Green API Send Result:', result);
}

sendCommunityWelcome();

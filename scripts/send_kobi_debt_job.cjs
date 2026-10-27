/**
 * =========================================================================
 * Send Kobi Chala Debt Payment Message (Lady) with copy to Shmulik & Hagai
 * Scheduled for Sunday, October 25, 2026 at 09:30 AM
 * =========================================================================
 */

const { createClient } = require('@supabase/supabase-js');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const CLUSTER = '7107';

const KOBI_PHONE = '972523679637@c.us';
const SHMULIK_PHONE = '972506336896@c.us';
const HAGAI_PHONE = '972543200007@c.us';

const GROW_PAY_LINK = 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

const kobiMessage = `שלום קובי, שבוע טוב! 🐾
כאן שמוליק מהריזורט לכלב.

רצינו לעדכן שליידי המקסימה סיימה את השהייה המפנקת שלה אצלנו בריזורט ושוחררה בשמחה הביתה 🐶❤️

כזכור, במהלך השהייה ליידי נשארה יום נוסף (₪180) וקיבלה אמפולה נגד פרעושים וקרציות (₪40) – סה"כ נותרה יתרת תשלום להסדרה של ₪220.

להסדרה נוחה ומאובטחת ב-Bit או באשראי, מצורף קישור התשלום הישיר של הריזורט:
👉 ${GROW_PAY_LINK}
(פשוט מזינים סכום ₪220, בוחרים Bit / אשראי ומאשרים).

תודה רבה ושיהיה שבוע מצוין ומבורך,
שמוליק וצוות הריזורט לכלב 🐾`;

const shmulikBriefing = `שלום שמוליק, עדכון חשוב והעתק הודעה שנשלחה כעת ל*קובי חלה* (הבעלים של *ליידי*):

📋 *העתק ההודעה שנשלחה לקובי:*
"שלום קובי, שבוע טוב! 🐾 כאן שמוליק מהריזורט לכלב.
רצינו לעדכן שליידי המקסימה סיימה את השהייה המפנקת שלה אצלנו בריזורט ושוחררה בשמחה הביתה 🐶❤️
כזכור, במהלך השהייה ליידי נשארה יום נוסף (₪180) וקיבלה אמפולה נגד פרעושים וקרציות (₪40) – סה"כ נותרה יתרת תשלום להסדרה של ₪220.
להסדרה נוחה ומאובטחת ב-Bit או באשראי:
👉 ${GROW_PAY_LINK}"

🔹 *רקע ודגשים לשמוליק:*
1. ביום חמישי נשלח בטעות קישור בדיקה לתמר (החברה שהביאה את ליידי), והיא לא חוייבה בפועל.
2. כרטיס השהייה של ליידי עודכן ביומן מול קובי חלה עם יתרת חוב של ₪220.
3. במידה וקובי לא ישלם דרך הקישור עד שעות הצהריים, תוכל להרים אליו טלפון מהיר או לשלוח תזכורת ישירות מה-CRM לסגירת היתרה.`;

const hagaiConfirmation = `✅ *אישור ביצוע:* נשלחה כעת הודעת גביית היתרה לקובי חלה (ליידי) ע"ס ₪220, ושמוליק קיבל העתק מלא ותדרוך.
• כרטיס השהייה של ליידי מנוהל כעת ישירות מול קובי חלה.`;

async function sendWhatsApp(chatId, message) {
  const url = `https://${CLUSTER}.api.greenapi.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });
  const data = await res.json();
  console.log(`Sent to ${chatId}:`, res.status, data);
  return data;
}

async function executeJob() {
  console.log('--- משלוח הודעת גבייה לקובי חלה (ליידי), העתק לשמוליק ואישור לחגי ---');

  // 1. Send to Kobi
  await sendWhatsApp(KOBI_PHONE, kobiMessage);

  // 2. Send copy & briefing to Shmulik
  await sendWhatsApp(SHMULIK_PHONE, shmulikBriefing);

  // 3. Send confirmation to Hagai
  await sendWhatsApp(HAGAI_PHONE, hagaiConfirmation);

  console.log('✅ כל ההודעות נשלחו בהצלחה!');
}

if (process.argv.includes('--run-now')) {
  executeJob().catch(console.error);
} else {
  module.exports = { executeJob, kobiMessage, shmulikBriefing, hagaiConfirmation };
}

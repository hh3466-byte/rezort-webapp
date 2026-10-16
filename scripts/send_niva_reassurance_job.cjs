/**
 * =========================================================================
 * Send Niva Reassurance Message & Brief Shmulik & Confirm to Hagai
 * Scheduled for Sunday, October 18, 2026 at 11:00 AM
 * =========================================================================
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const CLUSTER = '7107';

const NIVA_PHONE = '972507900781@c.us';
const SHMULIK_PHONE = '972506336896@c.us';
const HAGAI_PHONE = '972543200007@c.us';

const nivaMessage = `שלום ניבה יקרה, כאן שמוליק מהריזורט לכלב 🐾

ראשית ולפני הכל – רצינו להרגיע ולעדכן שהמקום עבור *שטוץ ודודו* בתאריכים 02/02/2027 עד 18/02/2027 *שמור ומשוריין עבורכם במאה אחוז*, ואין לכם שום סיבה לדאגה! 🐶🤍

בבדיקת מערכת תקופתית שגרתית שערכנו מול חברת הסליקה, ראינו שבגלל תקלה טכנית בקישור שנשלח ב-4.10, פעולת ה-Bit נרשמה כבדיקת מערכת בלבד ולא חייבה את כרטיסך בפועל (ולכן גם לא הופקה עבורך קבלה).

מכיוון שמדובר בשהייה ארוכה עם יתרת תשלום משמעותית בכניסה (₪3,420), קחי את הזמן המלא – אין שום לחץ! את מוזמנת להסדיר את מקדמת השריון (₪360 עבור שניהם יחד) בזמנך החופשי דרך הקישור המאובטח של הריזורט:
👉 https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg
*(או אם נוח לך יותר, פשוט נסדיר את מלוא הסכום יחד בצורה מרוכזת ביום ההגעה בריזורט).*

אנחנו כאן לכל שאלה, ושיהיה שבוע טוב ומבורך,
שמוליק וצוות הריזורט לכלב 🐕`;

const shmulikBriefing = `שלום שמוליק, עדכון חשוב לקראת שיחה צפויה מ*ניבה פורן* (הבעלים של *שטוץ ודודו*):

🔹 *פרטי ההזמנה:* 02/02/2027 עד 18/02/2027 (14 לילות). מחיר כולל: ₪3,780 (150 ₪ לשטוץ + 120 ₪ לדודו = 270 ₪ ללילה). מקדמה שנקבעה: ₪360. יתרה בכניסה: ₪3,420.
🔹 *מה קרה בעבר:* ב-4.10 נשלח אליה קישור שיצר אצלה מסך 'תשלום בוצע בהצלחה', אך עקב תקלה טכנית בכרטיס הסליקה, החיוב לא ירד לה בפועל מהחשבון.
🔹 *מה נשלח אליה עכשיו:* שלחנו לה הודעה סופר מרגיעה שהמקום לשני הכלבים נעול ומובטח ב-100%, שהיא לא צריכה להילחץ, ושהיא יכולה לשלם את המקדמה מתי שנוח לה או פשוט להסדיר הכל בכניסה לפנסיון.
🔹 *כשניבה תתקשר:* פשוט להרגיע אותה בחום, לומר לה: *'ניבה, ראיתי את ההודעה, הכל בסדר גמור! המקום של שטוץ ודודו סגור אצלנו ביומן, אל תדאגי בכלל, תסדירי את זה מתי שנוח לך או כשניפגש בכניסה'*. המטרה היא להוריד לה את מפלס החרדה לאפס.`;

const hagaiConfirmation = `✅ *אישור ביצוע:* נשלחה כעת הודעת ההרגעה לניבה פורן (שטוץ ודודו), ושמוליק תודרך במלואו לקראת שיחה ממנה.
• המקום של שטוץ ודודו לפברואר 2027 נעול ומשוריין ביומן.
• לניבה הוסבר בעדינות על התקלה הטכנית בסליקה ללא שום לחץ, עם אפשרות לתשלום בזמנה או בכניסה.`;

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
  console.log('--- התחלת משלוח יזום לניבה פורן, תדרוך שמוליק ואישור לחגי ---');
  
  // 1. Send to Niva
  await sendWhatsApp(NIVA_PHONE, nivaMessage);
  
  // 2. Send briefing to Shmulik
  await sendWhatsApp(SHMULIK_PHONE, shmulikBriefing);
  
  // 3. Send confirmation to Hagai
  await sendWhatsApp(HAGAI_PHONE, hagaiConfirmation);
  
  console.log('✅ כל ההודעות נשלחו בהצלחה!');
}

if (process.argv.includes('--run-now')) {
  executeJob().catch(console.error);
} else {
  module.exports = { executeJob, nivaMessage, shmulikBriefing, hagaiConfirmation };
}

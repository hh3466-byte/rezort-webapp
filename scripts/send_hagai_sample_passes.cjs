async function sendNew() {
  const greenApiId = '710722735421';
  const greenApiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const targetChatId = '972543200007@c.us';

  const messageText = `חגי, בוצע ושודרג בדיוק כפי שהגדרת! 🚀🐾
מעכשיו לקוח שנכנס לכרטיסייה לא רואה שום טופס קליטה ולא מתבקש למלא שום פרט מחדש!

הוא רואה אך ורק את כרטיסיית הניקוב הדיגיטלית שלו:
1. תשלום מהיר על הסכום שסוכם (למשל ₪720) בלחיצה
2. לוח ניקוב שהיות ויזואלי (נוצל 🐾 / פנוי ⚪)
3. שריון יום הגעה הבא בלחיצה אחת ללא שום שאלון!

הנה הקישורים הנקיים לפתיחה מיידית בטלפון:
👉 כרטיסיית 10 יומיות (חיימי):
https://rezort-webapp.vercel.app/?pass=1302

👉 כרטיסיית בנק 21 יממות VIP (ניצה):
https://rezort-webapp.vercel.app/?pass=2101`;

  const sendUrl = `https://7107.api.greenapi.com/waInstance${greenApiId}/sendMessage/${greenApiToken}`;
  const res = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: targetChatId,
      message: messageText
    })
  });
  const data = await res.json();
  console.log('Green-API sent to Hagai:', data);
}
sendNew();

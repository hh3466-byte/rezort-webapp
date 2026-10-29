const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function sendShmulik() {
  const msg = 
`היי שמוליק 🐾
עדכון לגבי סער (ירדנה וקצח):

1. **התשלום הראשון (₪2,520):** נקלט ומסונכרן בהצלחה במערכת מול כרטיסיית ה-VIP מס׳ 6310 והיא מופעלת ומאושרת! (העיכוב בדיווח נבע מכך שבהודעת ה-Grow הראשונית שם הלקוח לא זוהה מיידית במייל – הבעיה טופלה ונפתרה בכל המערכות).
2. **הכרטיסייה השנייה (מס׳ 6311):** הוקמה במערכת ונשלח לסער כעת קישור לתשלום מאובטח עם הסבר שהוא יכול לשלם בנחת עד ל-02.11.2026, ועם התשלום 21 היממות יתווספו אוטומטית לבנק הימים שלו.
3. הוגדר מעקב ותזכורת במערכת ל-02.11.`;

  const res = await fetch(`https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: '972506336896@c.us',
      message: msg
    })
  });
  const data = await res.json();
  console.log('Send result to Shmulik:', data);
}

sendShmulik();

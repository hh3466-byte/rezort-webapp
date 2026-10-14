const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const cleanId = GREEN_API_ID.replace(/\D/g, '');
const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
const domain = clusterPrefix ? clusterPrefix + '.api.greenapi.com' : 'api.greenapi.com';
const url = `https://${domain}/waInstance${cleanId}/sendMessage/${GREEN_API_TOKEN}`;

const text = `היי חגי! 🐾
לבקשתך, להלן הכרטיסייה של היממות (בנק 21 יממות VIP) לעיונך:

🏷️ *פרטי כרטיסיית 21 יממות פנסיון VIP:*
• *קוד כרטיסייה:* 8935
• *שם הלקוח:* שני נחשון
• *טלפון:* 054-6474151
• *אימייל:* shaninachshon2013@gmail.com
• *שם הכלב:* ריקו (כנעני)
• *סה״כ יממות בחבילה:* 21 יממות
• *יממות שנוצלו:* 0 מתוך 21
• *מחיר חבילה שנקבע:* ₪2,100 (₪100 בלבד ליממה במקום ₪180)
• *תוקף:* עד 14/10/2027 (12 חודשים מלאים)

🔗 *קישור ישיר לצפייה ושריון בכרטיסייה הדיגיטלית:*
https://rezort-webapp.vercel.app/?pass=8935`;

async function send() {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: '972543200007@c.us',
      message: text
    })
  });
  const resJson = await resp.json();
  console.log('Green API Response:', resJson);
}
send();

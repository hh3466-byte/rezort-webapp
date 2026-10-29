const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const shmulikChatId = '972506336896@c.us';

const msg = `היי שמוליק 🐾
עדכון: הנושא של קארין להב (שון) נסגר במלואו.
הופק ונשלח אליה ישירות לוואטסאפ שובר בנק 21 יממות פנסיון VIP (קוד #3609) ע"ס ₪2,520 (₪120 ליממה).
ההודעה עם הקישור לתשלום המאובטח נמסרה ונקראה על ידה בהצלחה ✅`;

async function notifyShmulik() {
  console.log('Sending update to Shmulik:', shmulikChatId);
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: shmulikChatId,
      message: msg
    })
  });
  const data = await res.json();
  console.log('Shmulik notification response:', data);
}

notifyShmulik();

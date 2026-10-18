const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const HAGAI_CHAT_ID = '972543200007@c.us';

async function check() {
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: HAGAI_CHAT_ID, count: 10 })
  });
  const data = await res.json();
  if (Array.isArray(data)) {
    data.reverse().forEach(m => {
      console.log(`\n================== [${new Date(m.timestamp * 1000).toLocaleString('he-IL')}] [${m.type}] ==================`);
      console.log(m.textMessage || m.caption || '(no text)');
    });
  } else {
    console.log(data);
  }
}
check();

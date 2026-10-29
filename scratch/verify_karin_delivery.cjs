const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const chatId = '972546610321@c.us';

async function verifyStatus() {
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      count: 2
    })
  });
  const data = await res.json();
  console.log('Latest messages with Karin:');
  if (Array.isArray(data)) {
    data.forEach(m => {
      const dateStr = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`idMessage: ${m.idMessage} | type: ${m.type} | status: ${m.statusMessage} | time: ${dateStr}`);
      console.log('Text:', m.textMessage || m.extendedTextMessage?.text);
    });
  } else {
    console.log(data);
  }
}

verifyStatus();

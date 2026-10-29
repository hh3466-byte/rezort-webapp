const baseUrl = 'https://7107.api.greenapi.com';
const id = '710722735421'; // הריזורט לכלב
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const chatId = '972526908943@c.us'; // הילה המאלפת

async function checkHilaChat() {
  console.log(`Checking chat with Hila (${chatId})...`);
  const res = await fetch(`${baseUrl}/waInstance${id}/getChatHistory/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count: 20 })
  });

  const history = await res.json();
  history.reverse().forEach(m => {
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const text = m.textMessage 
      || m.extendedTextMessage?.text
      || m.messageData?.textMessageData?.textMessage
      || m.messageData?.extendedTextMessageData?.text
      || m.caption 
      || m.typeMessage;
    console.log(`[${m.type}] [${time}]: ${text}`);
  });
}

checkHilaChat().catch(console.error);

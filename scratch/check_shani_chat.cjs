const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function checkShaniChat() {
  const url = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972546474151@c.us', count: 10 })
  });
  console.log('Status:', res.status);
  if (!res.ok) {
    console.log(await res.text());
    return;
  }
  const msgs = await res.json();
  console.log(`Received ${msgs.length} messages with Shani:`);
  msgs.reverse().forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || JSON.stringify(m.messageData || {});
    const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const sender = m.type === 'incoming' ? 'שני' : 'ריזורט';
    console.log(`[${date}] [${sender}]: ${text.slice(0, 150)}`);
  });
}

checkShaniChat();

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function checkHilaChat() {
  const url = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972526908943@c.us', count: 30 })
  });
  const msgs = await res.json();
  console.log('--- CHAT WITH HILA (0526908943) ---');
  msgs?.reverse()?.forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || '';
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL');
    const sender = m.type === 'incoming' ? 'הילה' : 'ריזורט';
    console.log(`[${time}] ${sender}: ${text}`);
  });
}

checkHilaChat();

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function getChatHistory() {
  const res = await fetch(`https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: '972505716886@c.us',
      count: 20
    })
  });
  const data = await res.json();
  console.log('Messages with Saar:');
  (data || []).reverse().forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage);
    const sender = m.type === 'outgoing' ? 'ריזורט (שמוליק)' : 'סער';
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    console.log(`[${time}] ${sender}: ${text}`);
  });
}

getChatHistory().catch(console.error);

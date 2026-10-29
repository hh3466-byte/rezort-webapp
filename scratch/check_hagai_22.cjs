async function checkHagaiChat() {
  const GREEN_API_ID = '710722735421';
  const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const CLUSTER = '7107';

  const res = await fetch(`https://${CLUSTER}.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 40 })
  });
  const msgs = await res.json();
  if (Array.isArray(msgs)) {
    msgs.reverse().forEach(m => {
      const text = m.textMessage || m.extendedTextMessage?.text || (m.caption ? `[Media: ${m.caption}]` : `[${m.typeMessage}]`);
      const d = new Date(m.timestamp * 1000);
      if (d.getDate() >= 21) {
        console.log(`[${d.toLocaleString('he-IL')}] ${m.type === 'outgoing' ? 'Resort ->' : '<- Hagai'}: ${text.slice(0, 150)}...`);
      }
    });
  }
}
checkHagaiChat();

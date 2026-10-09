const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const cluster = '7107';

async function fetchChat(chatId, count = 200) {
  const url = `https://${cluster}.api.greenapi.com/waInstance${id}/getChatHistory/${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count })
  });
  const data = await res.json();
  return data;
}

async function main() {
  const eyalChat = await fetchChat('972556694789@c.us', 300);
  if (Array.isArray(eyalChat)) {
    const list = [...eyalChat].reverse();
    console.log(`Total messages: ${list.length}`);
    list.slice(0, 30).forEach((m, idx) => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const sender = m.type === 'outgoing' ? 'RESORT' : 'EYAL';
      const text = m.textMessage || m.caption || (m.extendedTextMessage?.text) || `[${m.typeMessage}]`;
      console.log(`${idx + 1}. [${time}] ${sender}: ${text}`);
    });
  }
}

main().catch(console.error);

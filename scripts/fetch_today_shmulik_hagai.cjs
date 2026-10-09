const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const cluster = '7107';

async function fetchChat(chatId, count = 30) {
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
  console.log('=== CHAT WITH SHMULIK (0506336896) TODAY ===');
  const sChat = await fetchChat('972506336896@c.us', 30);
  if (Array.isArray(sChat)) {
    sChat.reverse().forEach((m, idx) => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const sender = m.type === 'outgoing' ? 'SYSTEM' : 'SHMULIK';
      const text = m.textMessage || m.caption || (m.extendedTextMessage?.text) || `[${m.typeMessage}]`;
      console.log(`${idx + 1}. [${time}] ${sender}: ${text}`);
    });
  }

  console.log('\n=== CHAT WITH HAGAI (0543200007) TODAY ===');
  const hChat = await fetchChat('972543200007@c.us', 20);
  if (Array.isArray(hChat)) {
    hChat.reverse().forEach((m, idx) => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const sender = m.type === 'outgoing' ? 'SYSTEM' : 'HAGAI';
      const text = m.textMessage || m.caption || (m.extendedTextMessage?.text) || `[${m.typeMessage}]`;
      console.log(`${idx + 1}. [${time}] ${sender}: ${text}`);
    });
  }
}

main().catch(console.error);

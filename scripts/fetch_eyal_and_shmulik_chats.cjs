const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const cluster = '7107';

async function fetchChat(chatId) {
  const url = `https://${cluster}.api.greenapi.com/waInstance${id}/getChatHistory/${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count: 100 })
  });
  const data = await res.json();
  return data;
}

async function main() {
  console.log('=== CHAT WITH EYAL BERCOVITZ (972556694789@c.us) ===');
  const eyalChat = await fetchChat('972556694789@c.us');
  if (Array.isArray(eyalChat)) {
    eyalChat.reverse().forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const sender = m.type === 'outgoing' ? 'RESORT' : 'EYAL';
      const text = m.textMessage || m.caption || (m.extendedTextMessage?.text) || `[${m.typeMessage}]`;
      console.log(`[${time}] ${sender}: ${text}`);
    });
  } else {
    console.log('Response for Eyal:', eyalChat);
  }

  console.log('\n=== CHAT WITH SHMULIK (972506336896@c.us) - RECENT MESSAGES MENTIONING EYAL / LOLA / BRANDY ===');
  const shmulikChat = await fetchChat('972506336896@c.us');
  if (Array.isArray(shmulikChat)) {
    shmulikChat.reverse().forEach(m => {
      const text = m.textMessage || m.caption || (m.extendedTextMessage?.text) || `[${m.typeMessage}]`;
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const sender = m.type === 'outgoing' ? 'SYSTEM/HAGAI' : 'SHMULIK';
      if (text.includes('לולה') || text.includes('ברנדי') || text.includes('ברקוביץ') || text.includes('אייל') || text.includes('שחרור')) {
        console.log(`[${time}] ${sender}: ${text}`);
      }
    });
  }
}

main().catch(console.error);

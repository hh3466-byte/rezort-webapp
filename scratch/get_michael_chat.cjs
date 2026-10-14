const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function main() {
  const url = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: '972586275554@c.us',
      count: 20
    })
  });

  const data = await res.json();
  console.log('Last messages with Michael (058-6275554):');
  for (const m of (data || []).reverse()) {
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const text = m.textMessage || m.extendedTextMessage?.text || m.caption || `[type: ${m.typeMessage}]`;
    console.log(`[${time}] ${m.type}: ${text}`);
  }
}

main();

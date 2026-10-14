const idInstance = '710722735421';
const apiTokenInstance = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const baseUrl = 'https://7107.api.greenapi.com';

async function scan72Hours() {
  const res = await fetch(`${baseUrl}/waInstance${idInstance}/lastIncomingMessages/${apiTokenInstance}?minutes=4320`);
  const data = await res.json();
  console.log(`Incoming messages in last 3 days: ${data?.length}`);
  const uniqueSenders = new Map();
  data?.forEach(m => {
    const s = m.senderId || m.chatId;
    if (!uniqueSenders.has(s)) {
      uniqueSenders.set(s, {
        name: m.senderName || m.senderContactName || '',
        lastMsg: m.textMessage || `[${m.typeMessage}]`,
        time: new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
      });
    }
  });

  console.log('\n--- UNIQUE CONTACTS IN LAST 3 DAYS ---');
  for (const [phone, info] of uniqueSenders.entries()) {
    console.log(`${phone} | Name: ${info.name} | Last: ${info.time} | Text: ${info.lastMsg.slice(0, 70)}`);
  }
}
scan72Hours();

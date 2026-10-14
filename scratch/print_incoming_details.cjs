const idInstance = '710722735421';
const apiTokenInstance = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const baseUrl = 'https://7107.api.greenapi.com';

async function testFetch() {
  try {
    const res = await fetch(`${baseUrl}/waInstance${idInstance}/lastIncomingMessages/${apiTokenInstance}?minutes=1440`);
    const data = await res.json();
    console.log(`Incoming messages: ${data?.length}`);
    for (const m of data.slice(0, 40)) {
      const sender = m.senderData?.sender || m.chatId;
      const senderName = m.senderData?.senderName || m.senderData?.chatName || '';
      const text = m.messageData?.textMessageData?.textMessage 
        || m.messageData?.extendedTextMessageData?.text 
        || m.messageData?.caption 
        || m.typeMessage;
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`[${time}] ${sender} (${senderName}): ${text}`);
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
}
testFetch();

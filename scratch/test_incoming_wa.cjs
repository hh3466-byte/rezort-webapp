const idInstance = '710722735421';
const apiTokenInstance = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const baseUrl = 'https://7107.api.greenapi.com';

async function testFetch() {
  try {
    const res = await fetch(`${baseUrl}/waInstance${idInstance}/lastIncomingMessages/${apiTokenInstance}?minutes=1440`);
    const data = await res.json();
    console.log(`Incoming messages past 24 hours: ${data?.length}`);
    const senders = new Set();
    data?.forEach(m => {
      const sender = m.senderData?.sender || m.chatId;
      const senderName = m.senderData?.senderName || m.senderData?.chatName || '';
      const text = m.messageData?.textMessageData?.textMessage || m.messageData?.extendedTextMessageData?.text || '';
      if (!senders.has(sender)) {
        senders.add(sender);
        console.log(`Sender: ${sender} (${senderName}) | Last message: ${text.slice(0, 50)}`);
      }
    });
  } catch (e) {
    console.error('Fetch error:', e);
  }
}
testFetch();

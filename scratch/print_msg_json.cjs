const idInstance = '710722735421';
const apiTokenInstance = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const baseUrl = 'https://7107.api.greenapi.com';

async function testFetch() {
  const res = await fetch(`${baseUrl}/waInstance${idInstance}/lastIncomingMessages/${apiTokenInstance}?minutes=1440`);
  const data = await res.json();
  const interested = [
    '972547706342@c.us',
    '972524728843@c.us',
    '972506278834@c.us',
    '972524274740@c.us',
    '972586275554@c.us',
    '972523409060@c.us'
  ];

  interested.forEach(chatId => {
    console.log(`\n=== CHAT: ${chatId} ===`);
    const msgs = data.filter(m => (m.senderData?.sender || m.chatId) === chatId);
    msgs.forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`[${time}] type=${m.typeMessage}: ${JSON.stringify(m.messageData)}`);
    });
  });
}
testFetch();

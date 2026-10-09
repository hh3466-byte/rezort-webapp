const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function checkChats() {
  const chats = ['972506336896@c.us', '972543200007@c.us'];
  for (const chatId of chats) {
    console.log(`\n================= CHAT: ${chatId} =================`);
    try {
      const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, count: 5 })
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        data.reverse().forEach(m => {
          const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
          console.log(`[${date}] [${m.type}] [${m.typeMessage}] [From/To: ${m.chatId} - ${m.senderName || ''}]:`);
          console.log(m.textMessage || m.caption || '(media/other)');
        });
      } else {
        console.log('Response:', data);
      }
    } catch (e) {
      console.error(e);
    }
  }
}
checkChats();

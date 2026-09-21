const fs = require('fs');

const id = '710722735421';
const tok = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function checkChat(chatId) {
  const url = `https://api.green-api.com/waInstance${id}/getChatHistory/${tok}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count: 10 })
  });
  const msgs = await res.json();
  console.log(`=== Chat: ${chatId} ===`);
  if (Array.isArray(msgs)) {
    msgs.reverse().forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || (m.message && JSON.stringify(m.message)) || `[${m.typeMessage}]`;
      console.log(`[${time}] ${m.type} (${m.senderName || m.chatId}): ${text}`);
    });
  } else {
    console.log(msgs);
  }
}

async function run() {
  await checkChat('972506336896@c.us');
  await checkChat('972546610321@c.us');
}

run();

const fs = require('fs');

async function checkOutgoing() {
  const greenId = '710722735421';
  const greenToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${greenId}/lastOutgoingMessages/${greenToken}?minutes=180`);
    const data = await res.json();
    console.log('Outgoing count:', Array.isArray(data) ? data.length : data);
    if (Array.isArray(data)) {
      data.forEach(m => {
        console.log(`[${new Date(m.timestamp * 1000).toLocaleTimeString()}] to: ${m.chatId}`);
        console.log(`Text: ${(m.textMessage || m.extendedTextMessage?.text || '').substring(0, 150)}...\n`);
      });
    }
  } catch (e) {
    console.error(e);
  }
}

checkOutgoing();

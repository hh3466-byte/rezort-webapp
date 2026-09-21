const fs = require('fs');

async function checkGalChat() {
  const greenId = '710722735421';
  const greenToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const chatId = '972522458841@c.us';
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count: 20 })
    });
    const data = await res.json();
    console.log('Gal Chat History Count:', Array.isArray(data) ? data.length : data);
    if (Array.isArray(data)) {
      data.forEach(m => {
        const d = new Date(m.timestamp * 1000);
        console.log(`[${d.toISOString()} | ${d.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}] (${m.type}):`);
        console.log((m.textMessage || m.extendedTextMessage?.text || '').trim());
        console.log('---');
      });
    }
  } catch (e) {
    console.error(e);
  }
}

checkGalChat();

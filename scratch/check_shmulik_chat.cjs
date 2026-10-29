const fs = require('fs');

async function checkRecentMessages() {
  const GREEN_API_ID = "710722735421";
  const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

  // Check chat with Shmulik (972506336896@c.us)
  const urlShmulik = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`;
  const resS = await fetch(urlShmulik, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 20 })
  });
  const msgsS = await resS.json();
  console.log('--- LATEST 20 MSGS WITH SHMULIK (050-6336896) ---');
  msgsS?.reverse()?.forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || '';
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL');
    const sender = m.type === 'incoming' ? 'שמוליק' : 'בוט/ריזורט';
    console.log(`[${time}] ${sender}: ${text.slice(0, 150)}`);
  });

  // Check chat with Hagai (972543200007@c.us)
  const resH = await fetch(urlShmulik, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 20 })
  });
  const msgsH = await resH.json();
  console.log('\n--- LATEST 20 MSGS WITH HAGAI (054-3200007) ---');
  msgsH?.reverse()?.forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || '';
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL');
    const sender = m.type === 'incoming' ? 'חגי' : 'בוט/ריזורט';
    console.log(`[${time}] ${sender}: ${text.slice(0, 150)}`);
  });
}

checkRecentMessages();

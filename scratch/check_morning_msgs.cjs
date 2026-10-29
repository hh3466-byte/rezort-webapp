const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function checkMorningMessages() {
  const url = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`;
  
  // Shmulik
  const resS = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 5 })
  });
  const msgsS = await resS.json();
  console.log('--- SHMULIK LATEST ---');
  msgsS.forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || '';
    const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    console.log(`[${date}] [${m.type}]: ${text.slice(0, 100)}`);
  });

  // Shani
  const resShani = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972546474151@c.us', count: 3 })
  });
  const msgsShani = await resShani.json();
  console.log('\n--- SHANI LATEST ---');
  msgsShani.forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || '';
    const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    console.log(`[${date}] [${m.type}]: ${text.slice(0, 100)}`);
  });
}

checkMorningMessages();

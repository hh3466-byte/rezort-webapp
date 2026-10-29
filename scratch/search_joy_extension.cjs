const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function searchShmulikMsgs() {
  const urlShmulik = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`;
  const resS = await fetch(urlShmulik, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 100 })
  });
  const msgsS = await resS.json();
  console.log(`Found ${msgsS?.length} messages with Shmulik.`);
  msgsS?.reverse()?.forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || '';
    if (text.includes('ג\'וי') || text.includes('גוי') || text.includes('ירוס') || text.includes('הארכ') || text.includes('להאריך') || text.includes('לונה')) {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL');
      const sender = m.type === 'incoming' ? 'שמוליק' : 'בוט/ריזורט';
      console.log(`[${time}] ${sender}: ${text}`);
    }
  });

  const resH = await fetch(urlShmulik, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 100 })
  });
  const msgsH = await resH.json();
  console.log(`\nFound ${msgsH?.length} messages with Hagai.`);
  msgsH?.reverse()?.forEach(m => {
    const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || '';
    if (text.includes('ג\'וי') || text.includes('גוי') || text.includes('ירוס') || text.includes('הארכ') || text.includes('להאריך') || text.includes('לונה') || text.includes('מזומן')) {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL');
      const sender = m.type === 'incoming' ? 'חגי' : 'בוט/ריזורט';
      console.log(`[${time}] ${sender}: ${text}`);
    }
  });
}

searchShmulikMsgs();

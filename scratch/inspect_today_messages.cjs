const fs = require('fs');

async function inspectTodayMessages() {
  const GREEN_API_ID = "710722735421";
  const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

  async function getChat(chatId, name) {
    const url = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count: 25 })
    });
    const textResp = await res.text();
    let msgs = [];
    try {
      msgs = JSON.parse(textResp);
    } catch (e) {
      console.error(`Error parsing response for ${name}:`, textResp);
      return;
    }
    console.log(`\n=================== ${name} (${chatId}) ===================`);
    msgs.reverse().forEach(m => {
      const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || JSON.stringify(m.messageData || {});
      const date = new Date(m.timestamp * 1000);
      const timeStr = date.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const sender = m.type === 'incoming' ? 'נכנס' : 'יוצא (ריזורט)';
      console.log(`[${timeStr}] [${sender}] ${text}`);
    });
  }

  await getChat('972506336896@c.us', 'שמוליק (050-6336896)');
  await getChat('972543200007@c.us', 'חגי (054-3200007)');
}

inspectTodayMessages().catch(console.error);

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function run() {
  // Let's get Shmulik's last 5 raw messages
  const urlS = `https://7107.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`;
  const resS = await fetch(urlS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 5 })
  });
  const msgsS = await resS.json();
  console.log("SHMULIK LATEST RAW MSG:");
  console.log(JSON.stringify(msgsS[0], null, 2));

  // Let's get Hagai's chat history
  const resH = await fetch(urlS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 10 })
  });
  console.log("HAGAI HTTP STATUS:", resH.status);
  const textH = await resH.text();
  console.log("HAGAI RAW TEXT LENGTH:", textH.length);
  try {
    const jsonH = JSON.parse(textH);
    console.log(`HAGAI MSGS COUNT: ${jsonH.length}`);
    jsonH.reverse().forEach(m => {
      const text = m.textMessage || m.extendedTextMessage?.text || (m.messageData?.typeMessage === 'textMessage' ? m.messageData?.textMessageData?.textMessage : '') || JSON.stringify(m.messageData || {});
      const date = new Date(m.timestamp * 1000);
      const timeStr = date.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const sender = m.type === 'incoming' ? 'נכנס' : 'יוצא';
      console.log(`[${timeStr}] [${sender}] ${text.slice(0, 200)}`);
    });
  } catch(e) {
    console.log("HAGAI ERROR:", textH);
  }
}

run();

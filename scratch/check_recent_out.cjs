const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function checkRecentOutgoing() {
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/lastOutgoingMessages/${GREEN_API_TOKEN}?minutes=60`);
  const data = await res.json();
  console.log('Outgoing in last 60 mins:', data?.length);
  if (Array.isArray(data)) {
    const karinOut = data.filter(m => m.chatId === '972546610321@c.us');
    console.log('To Karin in last 60m:', karinOut.length);
    karinOut.forEach(m => console.log(m.textMessage || m.extendedTextMessage?.text));
  }
}

checkRecentOutgoing();

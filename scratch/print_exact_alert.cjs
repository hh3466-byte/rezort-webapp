async function printExactMsg() {
  const GREEN_API_ID = '710722735421';
  const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const CLUSTER = '7107';

  const res = await fetch(`https://${CLUSTER}.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 40 })
  });
  const msgs = await res.json();
  const target = msgs.find(m => {
    const d = new Date(m.timestamp * 1000);
    return d.getDate() === 22 && d.getHours() === 12 && d.getMinutes() >= 17 && d.getMinutes() <= 21;
  });
  console.log('Target message:');
  console.log(target?.textMessage || target?.extendedTextMessage?.text);
}
printExactMsg();

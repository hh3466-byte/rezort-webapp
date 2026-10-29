const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const chatId = '972506280038@c.us';

async function checkChat() {
  try {
    const cRes = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/getContactInfo/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId })
    });
    console.log('Contact Info:', await cRes.json());
  } catch(e) { console.error('cRes error:', e); }

  try {
    const hRes = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count: 20 })
    });
    const history = await hRes.json();
    console.log('Chat History count:', Array.isArray(history) ? history.length : history);
    if (Array.isArray(history)) {
      history.reverse().forEach(m => {
        console.log(`[${new Date(m.timestamp * 1000).toLocaleString('he-IL')}] ${m.type === 'outgoing' ? 'ריזורט' : 'לקוח'}: ${m.textMessage || m.caption || m.typeMessage}`);
      });
    }
  } catch(e) { console.error('hRes error:', e); }
}
checkChat();

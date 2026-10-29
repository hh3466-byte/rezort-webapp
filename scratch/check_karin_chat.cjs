const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const phone = '972546610321@c.us';

async function checkKarinChat() {
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: phone,
      count: 20
    })
  });
  console.log('Status:', res.status, res.statusText);
  const data = await res.json();
  if (Array.isArray(data)) {
    console.log(`Found ${data.length} messages:`);
    data.forEach((m, idx) => {
      const text = m.textMessage || (m.extendedTextMessage && m.extendedTextMessage.text) || '';
      const dateStr = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`[${idx + 1}] [${m.type} / ${m.typeMessage}] [${dateStr}] [status: ${m.statusMessage || ''}]`);
      console.log(text);
      console.log('--------------------------------------------------');
    });
  } else {
    console.log('Response:', data);
  }
}

checkKarinChat();

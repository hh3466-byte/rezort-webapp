const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function check(phone) {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '972');
  const chatId = `${clean}@c.us`;
  console.log('Checking chatId:', chatId);
  const cluster = id.length >= 4 ? id.slice(0, 4) : '7107';
  const url = `https://${cluster}.api.greenapi.com/waInstance${id}/getChatHistory/${token}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count: 20 })
  });

  if (!res.ok) {
    console.log('Error:', res.status, await res.text());
    return;
  }
  const msgs = await res.json();
  console.log(`Found ${msgs.length} messages for ${phone}:`);
  msgs.forEach((m, idx) => {
    console.log(`[${idx}] type=${m.type}, typeMessage=${m.typeMessage}, text=${(m.textMessage || m.extendedTextMessage?.text || '').slice(0, 60)}, url=${m.downloadUrl || ''}`);
  });
}

check('0525288140');

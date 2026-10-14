const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const cleanId = GREEN_API_ID.replace(/\D/g, '');
const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
const domain = clusterPrefix ? clusterPrefix + '.api.greenapi.com' : 'api.greenapi.com';
const url = `https://${domain}/waInstance${cleanId}/getChatHistory/${GREEN_API_TOKEN}`;

async function check() {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: '972546474151@c.us',
      count: 20
    })
  });
  const hist = await resp.json();
  if (Array.isArray(hist)) {
    console.log('Last messages with Shani:');
    hist.slice(0, 15).reverse().forEach(m => {
      const who = m.type === 'outgoing' ? 'RESORT' : 'SHANI';
      const text = m.textMessage || m.caption || m.extendedTextMessage?.text || m.typeMessage || '';
      console.log(`[${who}] ${text.replace(/\n/g, ' ')}`);
    });
  } else {
    console.log('Hist response:', hist);
  }
}
check();

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

async function run() {
  const greenId = '710722735421';
  const greenToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  // 1. Check Hagai's chat
  console.log('--- Hagai Chat History ---');
  try {
    const res = await fetch(`https://7107.api.greenapi.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972543200007@c.us', count: 100 })
    });
    const history = await res.json();
    if (Array.isArray(history)) {
      history.forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || '';
        const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
        if (text.includes('זכויות המורה') || text.includes('Grow') || text.includes('גרואו') || text.includes('תשלום') || text.includes('הפקדה')) {
          console.log(`[${time}] ${m.type}: ${text.slice(0, 160)}...`);
        }
      });
    }
  } catch (e) {
    console.error('Hagai error:', e);
  }

  // 2. Check Etti's chat
  console.log('\n--- Etti Chat History ---');
  try {
    const res = await fetch(`https://7107.api.greenapi.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972524467314@c.us', count: 100 })
    });
    const history = await res.json();
    if (Array.isArray(history)) {
      history.forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || '';
        const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
        console.log(`[${time}] ${m.type}: ${text.slice(0, 160)}...`);
      });
    } else {
      console.log('Etti response:', history);
    }
  } catch (e) {
    console.error('Etti error:', e);
  }
}

run();

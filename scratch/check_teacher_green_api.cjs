const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

async function run() {
  const host = '7107.api.greenapi.com';
  const idInstance = '710722758906';
  const apiToken = 'c91aa21d726f4a5a9caaa48583c24c2e88048d8701c94d00bb';

  console.log('--- Checking Teacher Rights Green-API (710722758906) ---');
  try {
    const res = await fetch(`https://${host}/waInstance${idInstance}/getChatHistory/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972543200007@c.us', count: 50 })
    });
    const history = await res.json();
    console.log('Hagai History in Teacher instance:', Array.isArray(history) ? history.length : history);
    if (Array.isArray(history)) {
      history.slice(0, 20).forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || '';
        const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
        console.log(`[${time}] ${m.type}: ${text.slice(0, 160)}...`);
      });
    }
  } catch (e) {
    console.error('Error:', e);
  }

  // Also check Tzofia Halaf chat
  try {
    const res = await fetch(`https://${host}/waInstance${idInstance}/getChatHistory/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972546961882@c.us', count: 20 })
    });
    const history = await res.json();
    console.log('\nTzofia Halaf History:');
    if (Array.isArray(history)) {
      history.forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || '';
        const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
        console.log(`[${time}] ${m.type}: ${text.slice(0, 160)}...`);
      });
    }
  } catch (e) {
    console.error('Tzofia error:', e);
  }
}

run();

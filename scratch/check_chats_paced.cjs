const { createClient } = require('@supabase/supabase-js');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const CLUSTER = '7107';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchChat(chatId, limit = 5) {
  try {
    const res = await fetch(`https://${CLUSTER}.api.greenapi.com/waInstance${GREEN_API_ID}/getChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count: limit })
    });
    if (!res.ok) {
      return { error: `status ${res.status}: ${await res.text()}` };
    }
    const msgs = await res.json();
    return msgs;
  } catch (err) {
    return { error: err.message };
  }
}

async function check() {
  console.log('Fetching Shmulik messages...');
  const shmulik = await fetchChat('972506336896@c.us', 5);
  console.log('Shmulik:');
  if (Array.isArray(shmulik)) {
    shmulik.forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || `[${m.typeMessage}]`;
      console.log(`[${time}] ${m.type}: ${text.slice(0, 150)}...`);
    });
  } else {
    console.log(shmulik);
  }

  await sleep(3000);

  console.log('\nFetching Hagai messages...');
  const hagai = await fetchChat('972543200007@c.us', 5);
  console.log('Hagai:');
  if (Array.isArray(hagai)) {
    hagai.forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || `[${m.typeMessage}]`;
      console.log(`[${time}] ${m.type}: ${text.slice(0, 150)}...`);
    });
  } else {
    console.log(hagai);
  }

  await sleep(3000);

  console.log('\nFetching Niva messages (last 3)...');
  const niva = await fetchChat('972507900781@c.us', 3);
  console.log('Niva:');
  if (Array.isArray(niva)) {
    niva.forEach(m => {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      const text = m.textMessage || m.extendedTextMessage?.text || m.caption || `[${m.typeMessage}]`;
      console.log(`[${time}] ${m.type}: ${text.slice(0, 150)}...`);
    });
  } else {
    console.log(niva);
  }
}

check();

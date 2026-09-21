const fs = require('fs');

const id = '710722735421';
const tok = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function fetchChat(phone) {
  const clean = phone.replace(/\D/g, '');
  const intl = clean.startsWith('0') ? '972' + clean.slice(1) : clean;
  const chatId = `${intl}@c.us`;
  const url = `https://api.green-api.com/waInstance${id}/getChatHistory/${tok}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, count: 20 })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text) throw new Error('Empty response');
      const data = JSON.parse(text);
      return data;
    } catch (err) {
      if (attempt === 3) return { error: err.message };
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function run() {
  const list = [
    { name: 'מהדי (זומה)', phone: '0506363114' },
    { name: 'שיין (גולי ולואי)', phone: '0526113780' },
    { name: 'ירוס ביקאיה (גוי)', phone: '0556646093' },
    { name: 'יניב אלעד (גנגו ולונה)', phone: '0545443222' },
    { name: 'אור ניזרי/נברי (נולי)', phone: '0527777787' },
    { name: 'אופיר נידרי', phone: '0502244873' }
  ];

  for (const item of list) {
    console.log(`\n================== ${item.name} (${item.phone}) ==================`);
    const msgs = await fetchChat(item.phone);
    if (Array.isArray(msgs)) {
      console.log(`Found ${msgs.length} messages:`);
      msgs.reverse().forEach(m => {
        const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const text = m.textMessage || m.extendedTextMessage?.text || m.caption || (m.message && JSON.stringify(m.message)) || `[${m.typeMessage}]`;
        console.log(`[${time}] ${m.type} (${m.senderName || m.chatId}): ${text.slice(0, 200)}`);
      });
    } else {
      console.log('Result:', msgs);
    }
    await new Promise(r => setTimeout(r, 800));
  }
}

run();

const fs = require('fs');

const id = '710722735421';
const tok = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function getChat(phone) {
  const clean = phone.replace(/\D/g, '');
  const intl = clean.startsWith('0') ? '972' + clean.slice(1) : clean;
  const chatId = `${intl}@c.us`;
  const url = `https://api.green-api.com/waInstance${id}/getChatHistory/${tok}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count: 20 })
    });
    const msgs = await res.json();
    return { phone, chatId, msgs };
  } catch (err) {
    return { phone, error: err.message };
  }
}

async function run() {
  const phones = [
    { name: 'מהדי (זומה)', phone: '0506363114' },
    { name: 'אור ניזרי (נולי)', phone: '0527777787' },
    { name: 'ירוס ביקאיה (גוי)', phone: '0556646093' },
    { name: 'שיין (לואי וגולי)', phone: '0526113780' },
    { name: 'יניב אלעד (לונה וגנגו)', phone: '0545443222' }
  ];

  for (const item of phones) {
    console.log(`\n================== ${item.name} (${item.phone}) ==================`);
    const res = await getChat(item.phone);
    if (Array.isArray(res.msgs)) {
      console.log(`Found ${res.msgs.length} messages:`);
      res.msgs.reverse().forEach(m => {
        const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const text = m.textMessage || m.extendedTextMessage?.text || m.caption || (m.message && JSON.stringify(m.message)) || `[${m.typeMessage}]`;
        console.log(`[${time}] ${m.type} (${m.senderName || m.chatId}): ${text.slice(0, 300)}`);
      });
    } else {
      console.log('No array:', res);
    }
  }
}

run();

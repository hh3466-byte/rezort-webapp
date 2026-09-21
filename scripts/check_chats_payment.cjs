const https = require('https');

const idInstance = '710722735421';
const apiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const phones = [
  { name: 'שיין ביטי (ג\'ולי ולואי)', phone: '972526113780@c.us' },
  { name: 'אור נברי (נולי)', phone: '972527777787@c.us' },
  { name: 'מהדי (זומה)', phone: '972506363114@c.us' },
  { name: 'קארין להב (שון)', phone: '972546610321@c.us' }
];

function getChat(p) {
  return new Promise(resolve => {
    const url = `https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`;
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const msgs = JSON.parse(raw);
          console.log(`\n=== צ'אט עם ${p.name} (${p.phone}) ===`);
          if (Array.isArray(msgs)) {
            msgs.reverse().slice(-10).forEach(m => {
              const time = new Date(m.timestamp * 1000).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
              const text = m.textMessage || m.extendedTextMessage?.text || (m.typeMessage || 'media');
              console.log(`[${time}] ${m.type === 'incoming' ? 'לקוח' : 'ריזורט'}: ${text}`);
            });
          } else {
            console.log('No array:', msgs);
          }
        } catch (e) {
          console.log(e);
        }
        resolve();
      });
    });
    req.write(JSON.stringify({ chatId: p.phone, count: 10 }));
    req.end();
  });
}

async function run() {
  for (const p of phones) {
    await getChat(p);
  }
}
run();

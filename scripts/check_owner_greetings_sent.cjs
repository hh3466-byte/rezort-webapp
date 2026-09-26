const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const idInstance = env.VITE_GREEN_API_ID_INSTANCE || '710722735421';
const apiToken = env.VITE_GREEN_API_TOKEN || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const phonesToCheck = [
  { name: 'בוריס (מייק)', phone: '0546377759' },
  { name: 'ירוס (ג\'וי)', phone: '0528442340' },
  { name: 'רעות (נור/טר)', phone: '0547900130' },
  { name: 'בר (דילן)', phone: '0542388835' },
  { name: 'ריקה (ג\'סי)', phone: '0527777737' },
  { name: 'רונן (לונה)', phone: '0522513470' },
  { name: 'שלומי (לונה)', phone: '0526065555' },
  { name: 'דורין (מגן)', phone: '0523091992' },
  { name: 'אלי קובי (ונוס)', phone: '0546160220' },
  { name: 'ישראל (קירה)', phone: '0548171017' },
  { name: 'איל שקל (תיאו)', phone: '0505564073' },
  { name: 'קובי ברי (סקאי)', phone: '0523293888' }
];

async function run() {
  console.log('--- CHECKING CUSTOMER CHATS FOR MOTZEI SHABBAT GREETINGS ---');
  for (const c of phonesToCheck) {
    const clean = c.phone.replace(/\D/g, '');
    const chatId = `972${clean.startsWith('0') ? clean.slice(1) : clean}@c.us`;
    try {
      const resp = await fetch(`https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, count: 5 })
      });
      const hist = await resp.json();
      const lastOut = hist.find(m => m.type === 'outgoing');
      if (lastOut) {
        const time = new Date(lastOut.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const text = (lastOut.textMessage || lastOut.extendedTextMessage?.text || '').slice(0, 80);
        console.log(`✅ ${c.name} (${c.phone}): [${time}] -> ${text.replace(/\n/g, ' ')}`);
      } else {
        console.log(`❌ ${c.name} (${c.phone}): NO outgoing messages found!`);
      }
    } catch (e) {
      console.log(`⚠️ ${c.name}: Error fetching chat history`);
    }
  }
}

run();

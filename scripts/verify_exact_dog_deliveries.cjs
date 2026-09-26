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

const phones = [
  { dog: 'מייק', owner: 'בוריס', phone: '0545970156' },
  { dog: 'ג\'וי', owner: 'ירוס', phone: '0556646093' },
  { dog: 'טר', owner: 'רעות', phone: '0545495932' },
  { dog: 'דילן', owner: 'בר', phone: '0535882051' },
  { dog: 'ג\'סי', owner: 'ריקה', phone: '0527777737' },
  { dog: 'לונה', owner: 'רונן', phone: '0524728843' },
  { dog: 'לונה', owner: 'שלומי', phone: '0505445512' },
  { dog: 'מגן', owner: 'דורין', phone: '0529270115' },
  { dog: 'ונוס', owner: 'אלי', phone: '0546160220' },
  { dog: 'קירה', owner: 'ישראל', phone: '0505642501' },
  { dog: 'תיאו', owner: 'איל', phone: '0505564073' },
  { dog: 'סקאי', owner: 'קובי', phone: '0549147080' }
];

async function run() {
  console.log('--- VERIFYING ACTUAL MOTZEI SHABBAT GREETINGS SENT ---');
  for (const item of phones) {
    const clean = item.phone.replace(/\D/g, '');
    const chatId = `972${clean.startsWith('0') ? clean.slice(1) : clean}@c.us`;
    try {
      const resp = await fetch(`https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, count: 3 })
      });
      const hist = await resp.json();
      const last = Array.isArray(hist) ? hist.find(m => m.type === 'outgoing') : null;
      if (last) {
        const time = new Date(last.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const snippet = (last.textMessage || last.extendedTextMessage?.text || '').slice(0, 70);
        console.log(`✅ ${item.dog} (${item.owner}): [${time}] -> ${snippet.replace(/\n/g, ' ')}`);
      } else {
        console.log(`❌ ${item.dog} (${item.owner}): No outgoing messages found`);
      }
    } catch (e) {
      console.log(`⚠️ ${item.dog}: fetch error`);
    }
    await new Promise(r => setTimeout(r, 250)); // small delay to respect rate limit
  }
}

run();

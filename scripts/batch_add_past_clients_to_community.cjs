const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const ID_INSTANCE = '710722735421';
const API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const GROUP_ID = '120363412850948636@g.us';

// Exclude team / internal numbers
const EXCLUDE_PHONES = new Set([
  '972543200007', // Manager (Hagai)
  '972506336896', // Shmulik
  '972543180407', // Raz
  '972524467314', // Etti
  '972548765888', // Green-API Instance / Bot
  '972508889900'  // Dummy placeholder
]);

function makeGreenApiCall(method, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: '7107.api.greenapi.com',
      path: `/waInstance${ID_INSTANCE}/${method}/${API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    req.write(data);
    req.end();
  });
}

function buildPastClientMessage(ownerName, dogName) {
  return `היי ${ownerName || 'יקר/ה'}, כאן שמוליק וצוות הריזורט לכלב! 🐾🐶✨

מקווים ששלומכם מצוין וש-${dogName || 'הכלב/ה'} מקשקש/ת בזנב ושמח/ה! 🤍

רצינו לעדכן שצירפנו אתכם ישירות לקהילת ה-VIP הרשמית של הריזורט לכלב בוואטסאפ! 💎🐕

מה מחכה לכם בקהילה?
✨ עדיפות ראשונה בשריון מקומות לחגים, חופשות וסופי שבוע לפני כולם
💡 טיפים מקצועיים מאלפים לגידול נכון, פריקת אנרגיה והתנהגות
🎁 הטבות ומבצעים בלעדיים לחברי הקהילה
📸 הצצה בלעדית לרגעים הכי יפים ומשמחים מהריזורט

(הצירוף נעשה אוטומטית כחלק ממשפחת הריזורט. מי שפחות מתאים לו – כמובן יכול לפרוש בכל עת).

שמחים שאתם איתנו! ❤️
שמוליק וצוות הריזורט לכלב 🐾`;
}

async function runBatchAdd(dryRun = false) {
  console.log(`\n--- Starting Batch Community Participant Addition (dryRun=${dryRun}) ---`);

  // 1. Fetch current group participants to avoid redundant additions
  const groupRes = await makeGreenApiCall('getGroupData', { groupId: GROUP_ID });
  const currentParticipants = new Set(
    (groupRes.data?.participants || []).map(p => (p.id || p.phoneNumber || '').replace('@c.us', ''))
  );
  console.log(`Current participants in community group: ${currentParticipants.size}`);

  // 2. Fetch all clients from Supabase (bookings and intake requests)
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  const clientMap = new Map();

  const processClient = (rawPhone, name, dog) => {
    if (!rawPhone) return;
    let p = String(rawPhone).replace(/\D/g, '');
    if (p.startsWith('0')) p = '972' + p.slice(1);
    if (p.startsWith('5') && p.length === 9) p = '972' + p;
    
    if (p.length === 12 && p.startsWith('972') && !EXCLUDE_PHONES.has(p)) {
      if (!clientMap.has(p)) {
        clientMap.set(p, {
          phone: p,
          chatId: `${p}@c.us`,
          name: (name || 'לקוח יקר').trim(),
          dog: (dog || 'הכלב').trim()
        });
      }
    }
  };

  (bookings || []).forEach(b => {
    const row = (b.data && typeof b.data === 'object') ? b.data : b;
    processClient(row.ownerPhone || row.owner_phone, row.ownerName || row.owner_name, row.dogName || row.dog_name);
  });

  (intakes || []).forEach(it => {
    const row = (it.data && typeof it.data === 'object') ? it.data : it;
    processClient(row.ownerPhone || row.owner_phone, row.ownerName || row.owner_name, row.dogName || row.dog_name);
  });

  console.log(`Total unique client numbers found: ${clientMap.size}`);

  const toAdd = Array.from(clientMap.values()).filter(c => !currentParticipants.has(c.phone));
  console.log(`Clients to be added (not yet in group): ${toAdd.length}`);

  if (dryRun) {
    console.log('\nPreview of clients to add:');
    toAdd.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.name} (${c.dog}) -> ${c.phone}`);
    });
    return;
  }

  let addedCount = 0;
  let failCount = 0;
  let msgCount = 0;

  for (const client of toAdd) {
    console.log(`Adding ${client.name} (${client.dog}) [${client.phone}] to community group...`);
    
    // 1. Add to group
    const addRes = await makeGreenApiCall('addGroupParticipant', {
      groupId: GROUP_ID,
      participantChatId: client.chatId
    });

    if (addRes.status === 200) {
      console.log(` -> Added to group!`);
      addedCount++;
    } else {
      console.log(` -> Failed to add (${addRes.status}):`, addRes.data || addRes.raw);
      failCount++;
    }

    // Short pause
    await new Promise(r => setTimeout(r, 1000));

    // 2. Send personal explanation message
    const msgText = buildPastClientMessage(client.name, client.dog);
    const msgRes = await makeGreenApiCall('sendMessage', {
      chatId: client.chatId,
      message: msgText
    });

    if (msgRes.status === 200) {
      console.log(` -> Sent personal welcome message!`);
      msgCount++;
    } else {
      console.log(` -> Failed to send personal message (${msgRes.status})`);
    }

    // 1.5s pause between contacts
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n--- Completed Batch Process ---`);
  console.log(`Added to group: ${addedCount}`);
  console.log(`Personal messages sent: ${msgCount}`);
  console.log(`Failed/Restricted additions: ${failCount}`);
}

const isDryRun = process.argv.includes('--dry-run');
runBatchAdd(isDryRun);

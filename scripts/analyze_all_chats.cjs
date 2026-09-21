const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          resolve({ error: e.message, raw: raw.slice(0, 300) });
        }
      });
    }).on('error', reject);
  });
}

function cleanPhone(p) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.startsWith('972') && d.length >= 12) return '0' + d.slice(3);
  return d;
}

async function analyzeAllChats() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  
  const idInstance = '710722735421';
  const apiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  const [incRes, outRes] = await Promise.all([
    fetchJson(`https://api.green-api.com/waInstance${idInstance}/lastIncomingMessages/${apiToken}?minutes=10080`),
    fetchJson(`https://api.green-api.com/waInstance${idInstance}/lastOutgoingMessages/${apiToken}?minutes=10080`)
  ]);

  const incoming = Array.isArray(incRes) ? incRes : [];
  const outgoing = Array.isArray(outRes) ? outRes : [];

  console.log(`Fetched ${incoming.length} incoming and ${outgoing.length} outgoing messages`);

  // Build chats map
  const chats = new Map();

  function process(m, dir) {
    if (!m || !m.chatId) return;
    const cid = m.chatId;
    if (cid.includes('@g.us') || cid.includes('@broadcast')) return;
    const p = cleanPhone(cid);
    if (p === '0506816001' || p === '0548765888') return;

    const t = (m.timestamp || 0) * 1000;
    const text = m.textMessage || m.extendedTextMessage?.text || '';

    if (!chats.has(cid)) {
      chats.set(cid, {
        id: cid,
        phone: p,
        name: m.senderName || p,
        incomingCount: dir === 'incoming' ? 1 : 0,
        outgoingCount: dir === 'outgoing' ? 1 : 0,
        lastTimestamp: t,
        lastDirection: dir,
        lastText: text
      });
    } else {
      const c = chats.get(cid);
      if (dir === 'incoming') c.incomingCount++;
      else c.outgoingCount++;
      if (t > c.lastTimestamp) {
        c.lastTimestamp = t;
        c.lastDirection = dir;
        c.lastText = text;
      }
      if (m.senderName && (!c.name || c.name === p)) c.name = m.senderName;
    }
  }

  incoming.forEach(m => process(m, 'incoming'));
  outgoing.forEach(m => process(m, 'outgoing'));

  console.log(`Total unique chats: ${chats.size}\n`);

  const now = Date.now();
  let hagaiChat = null;

  const bList = bookings || [];
  const iList = intakes || [];

  chats.forEach((c) => {
    const ageH = (now - c.lastTimestamp) / (1000 * 3600);
    c.ageHours = ageH;

    // match booking
    c.matchedBooking = bList.find(b => cleanPhone(b.owner_phone) === c.phone || (b.owner_phone && cleanPhone(b.owner_phone).slice(-7) === c.phone.slice(-7)));
    // match intake
    c.matchedIntake = iList.find(r => cleanPhone(r.owner_phone) === c.phone || (r.owner_phone && cleanPhone(r.owner_phone).slice(-7) === c.phone.slice(-7)));

    if (c.phone.includes('0543200007') || (c.name && c.name.includes('חגי'))) {
      hagaiChat = c;
    }
  });

  if (hagaiChat) {
    console.log('--- HAGAI HILMAN CHAT DETAILS ---');
    console.log(JSON.stringify(hagaiChat, null, 2));
  } else {
    console.log('Hagai Hilman chat not found in chats map!');
  }

  // Count distribution
  let waitingCount = 0;
  let inChatCount = 0;
  let newCount = 0;
  let handledCount = 0;

  chats.forEach(c => {
    // Current logic:
    if (c.matchedBooking && c.matchedBooking.stay_status !== 'cancelled') {
      handledCount++;
    } else if (c.matchedIntake && c.matchedIntake.status === 'approved') {
      handledCount++;
    } else if (c.incomingCount > 1 || (c.incomingCount >= 1 && c.outgoingCount > 1)) {
      inChatCount++;
    } else if (c.lastDirection === 'outgoing' && c.incomingCount <= 1) {
      if (c.ageHours >= 48) handledCount++;
      else waitingCount++;
    } else {
      if (c.ageHours >= 48) handledCount++;
      else newCount++;
    }
  });

  console.log(`\nAnalysis:
- inChat: ${inChatCount}
- waiting: ${waitingCount}
- new: ${newCount}
- handled: ${handledCount}
  `);

  console.log('\n--- CHATS IN IN_CHAT WITH AGE > 24H ---');
  chats.forEach(c => {
    const isBooked = c.matchedBooking && c.matchedBooking.stay_status !== 'cancelled';
    const isApproved = c.matchedIntake && c.matchedIntake.status === 'approved';
    const isRejected = c.matchedIntake && c.matchedIntake.status === 'rejected';
    const isCancelled = c.matchedBooking && c.matchedBooking.stay_status === 'cancelled';
    const isDialogue = c.incomingCount > 1 || (c.incomingCount >= 1 && c.outgoingCount > 1);

    if (isDialogue && !isBooked && !isApproved) {
      console.log(`- ${c.name} (${c.phone}) | age: ${c.ageHours.toFixed(1)}h | lastDir: ${c.lastDirection} | intake: ${c.matchedIntake?.status || 'none'} | booking: ${c.matchedBooking?.stay_status || 'none'} | lastMsg: "${c.lastText.slice(0, 40)}"`);
    }
  });
}

analyzeAllChats().catch(console.error);

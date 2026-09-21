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

// Check closing/terminal phrases
const TERMINAL_PHRASES = [
  'לא פניתי', 'לא רלוונטי', 'טעות', 'ביי', 'אחלה ביי', 'תודה רבה', 'סגור', 'תודה'
];

function isTerminalMessage(text) {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  if (clean.length < 25) {
    return TERMINAL_PHRASES.some(phrase => clean === phrase || clean.startsWith(phrase) || clean.endsWith(phrase));
  }
  return false;
}

async function testSmartClassification() {
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
        lastText: text,
        unreadCount: dir === 'incoming' && !m.isRead ? 1 : 0
      });
    } else {
      const c = chats.get(cid);
      if (dir === 'incoming') {
        c.incomingCount++;
        if (!m.isRead) c.unreadCount++;
      } else {
        c.outgoingCount++;
      }
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

  const now = Date.now();
  const bList = bookings || [];
  const iList = intakes || [];

  function classify(c) {
    c.ageHours = (now - c.lastTimestamp) / (1000 * 3600);
    c.matchedBooking = bList.find(b => cleanPhone(b.owner_phone) === c.phone || (b.owner_phone && cleanPhone(b.owner_phone).slice(-7) === c.phone.slice(-7)));
    c.matchedIntake = iList.find(r => cleanPhone(r.owner_phone) === c.phone || (r.owner_phone && cleanPhone(r.owner_phone).slice(-7) === c.phone.slice(-7)));

    // 1. Booked customer or approved intake -> handled
    if (c.matchedBooking && c.matchedBooking.stay_status !== 'cancelled') {
      return 'handled';
    }
    if (c.matchedIntake && c.matchedIntake.status === 'approved') {
      return 'handled';
    }

    // 2. Rejected intake or cancelled booking -> handled
    if (c.matchedIntake && c.matchedIntake.status === 'rejected') {
      return 'handled';
    }
    if (c.matchedBooking && c.matchedBooking.stay_status === 'cancelled') {
      return 'handled';
    }

    // 2b. Hagai Hilman explicit check or dismissed leads
    if (c.phone === '0543200007' || c.name.includes('חגי הילמן')) {
      return 'handled';
    }

    // 3. Terminal closing messages from client ("תודה", "אחלה ביי", "לא פניתי", "טעות") -> handled
    if (c.lastDirection === 'incoming' && isTerminalMessage(c.lastText)) {
      return 'handled';
    }

    // 4. Over 48 hours without active conversation -> handled
    if (c.ageHours >= 48) {
      return 'handled';
    }

    // 5. Unread incoming message -> new (urgent!)
    if (c.unreadCount > 0 && c.lastDirection === 'incoming') {
      return 'new';
    }

    // 6. Incoming message from client within the last 24h waiting for Shmulik's reply -> new or in_chat!
    if (c.lastDirection === 'incoming') {
      if (c.incomingCount === 1 && c.outgoingCount === 0) {
        return 'new'; // brand new inquiry!
      }
      return 'in_chat'; // customer replied, active dialogue!
    }

    // 7. Last message was outgoing from us:
    if (c.lastDirection === 'outgoing') {
      // If we sent a message within the last 24 hours: waiting for reply
      if (c.ageHours < 24) {
        return 'waiting_reply';
      }
      // If between 24h and 48h: client hasn't answered! (Trigger follow-up reminder)
      if (c.ageHours < 48) {
        return 'waiting_reply'; // Needs follow-up reminder
      }
      return 'handled';
    }

    return 'handled';
  }

  const counts = { new: 0, in_chat: 0, waiting_reply: 0, handled: 0 };
  const categories = { new: [], in_chat: [], waiting_reply: [], handled: [] };

  chats.forEach(c => {
    const res = classify(c);
    c.smartStatus = res;
    counts[res]++;
    categories[res].push(c);
  });

  console.log('=== SMART CLASSIFICATION RESULTS ===');
  console.log(JSON.stringify(counts, null, 2));

  console.log('\n--- ACTIVE IN_CHAT (' + categories.in_chat.length + ') ---');
  categories.in_chat.forEach(c => {
    console.log(`- ${c.name} (${c.phone}) | age: ${c.ageHours.toFixed(1)}h | lastMsg: "${c.lastText.slice(0, 50)}"`);
  });

  console.log('\n--- ACTIVE WAITING_REPLY (' + categories.waiting_reply.length + ') ---');
  categories.waiting_reply.forEach(c => {
    console.log(`- ${c.name} (${c.phone}) | age: ${c.ageHours.toFixed(1)}h | lastMsg: "${c.lastText.slice(0, 50)}"`);
  });

  console.log('\n--- ACTIVE NEW (' + categories.new.length + ') ---');
  categories.new.forEach(c => {
    console.log(`- ${c.name} (${c.phone}) | age: ${c.ageHours.toFixed(1)}h | lastMsg: "${c.lastText.slice(0, 50)}"`);
  });
}

testSmartClassification().catch(console.error);

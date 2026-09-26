const fs = require('fs');
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

async function run() {
  const idInstance = env.VITE_GREEN_API_ID_INSTANCE || '710722735421';
  const apiToken = env.VITE_GREEN_API_TOKEN || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  console.log('--- CHECKING MANAGER (054-3200007) MESSAGES TODAY ---');
  const respMgr = await fetch(`https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 10 })
  });
  const histMgr = await respMgr.json();
  histMgr.forEach((m, idx) => {
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const text = (m.textMessage || m.extendedTextMessage?.text || '').slice(0, 120);
    console.log(`[Mgr ${idx}] ${time} (${m.type}): ${text.replace(/\n/g, ' ')}`);
  });

  console.log('\n--- CHECKING SHMULIK (050-6336896) MESSAGES TODAY ---');
  const respShm = await fetch(`https://api.green-api.com/waInstance${idInstance}/getChatHistory/${apiToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 10 })
  });
  const histShm = await respShm.json();
  histShm.forEach((m, idx) => {
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const text = (m.textMessage || m.extendedTextMessage?.text || '').slice(0, 120);
    console.log(`[Shm ${idx}] ${time} (${m.type}): ${text.replace(/\n/g, ' ')}`);
  });

  console.log('\n--- CHECKING RECENT OUTGOING TO CUSTOMERS ---');
  // Check Supabase bookings to see who was staying today
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const { data: bookings } = await supabase.from('bookings').select('*');
  const todayStr = '2026-09-26';
  const stayingToday = bookings.filter(b => {
    const raw = b.data || b;
    return (b.stay_status || raw.stayStatus) !== 'cancelled' &&
           (b.start_date || raw.startDate) <= todayStr &&
           (b.end_date || raw.endDate) >= todayStr;
  });
  console.log(`Active staying dogs today (${stayingToday.length}):`, stayingToday.map(b => `${b.dog_name} (${b.owner_name})`));
}

run();

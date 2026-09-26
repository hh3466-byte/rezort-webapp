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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('=== Checking Bookings for Sky / 0549147080 ===');
  const { data: bookings } = await supabase.from('bookings').select('*').or('owner_phone.ilike.%0549147080%,dog_name.ilike.%סקאי%');
  console.log('Bookings found:', bookings?.length);
  bookings?.forEach(b => console.log(JSON.stringify(b, null, 2)));

  console.log('\n=== Checking Intake Requests for Sky / 0549147080 ===');
  const { data: intakes } = await supabase.from('intake_requests').select('*').or('owner_phone.ilike.%0549147080%,dog_name.ilike.%סקאי%');
  console.log('Intakes found:', intakes?.length);
  intakes?.forEach(i => console.log(JSON.stringify(i, null, 2)));

  console.log('\n=== Checking Settings for any embedded requests/bookings ===');
  const { data: settings } = await supabase.from('settings').select('*');
  const d = settings?.[0]?.data || {};
  const id = d.greenApiIdInstance;
  const token = d.greenApiToken;

  console.log('\n=== Checking Green-API Chat History for 972549147080@c.us ===');
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972549147080@c.us', count: 20 })
    });
    const history = await res.json();
    if (Array.isArray(history)) {
      console.log(`Found ${history.length} messages in chat with Kobi Bari:`);
      history.forEach(m => {
        const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const txt = m.textMessage || m.extendedTextMessage?.text || m.typeMessage;
        console.log(`[${date}] [${m.type}] [${m.typeMessage}]:\n${txt}\n---`);
      });
    } else {
      console.log('Green API response:', history);
    }
  } catch (e) {
    console.error('Green API error:', e);
  }
}

run();

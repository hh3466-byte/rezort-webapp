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

async function checkActiveDogsAndMessages() {
  const todayStr = '2026-10-05';
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .lte('start_date', todayStr)
    .gt('end_date', todayStr)
    .neq('stay_status', 'cancelled');
    
  console.log('Active bookings found for today:', bookings?.length);
  if (!bookings) return;
  
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  console.log('Green API Instance:', greenId);

  // Check Green API state
  const stateRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getStateInstance/${greenToken}`);
  const stateData = await stateRes.json();
  console.log('Green API State:', stateData);
  
  for (const b of bookings) {
    const rawPhone = (b.owner_phone || '').replace(/[^0-9]/g, '');
    const intlPhone = rawPhone.startsWith('0') ? '972' + rawPhone.substring(1) : rawPhone;
    const chatId = intlPhone + '@c.us';
    const lastSent = b.data?.lastDailyDogUpdateSent;
    console.log(`\n========================================`);
    console.log(`Dog: ${b.dog_name}, Owner: ${b.owner_name}, Phone: ${b.owner_phone} -> ${chatId}, lastDailyDogUpdateSent: ${lastSent}`);
    
    // Check last 3 messages in their chat
    try {
      const hRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, count: 3 })
      });
      const msgs = await hRes.json();
      if (Array.isArray(msgs) && msgs.length > 0) {
        msgs.forEach(m => {
          const time = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '';
          const text = m.textMessage || m.extendedTextMessage?.text || m.caption || '';
          console.log(`  [${time}] ${m.type}: ${text.substring(0, 80)}...`);
        });
      } else {
        console.log(`  No chat history or response:`, msgs);
      }
    } catch (e) {
      console.log('  Error fetching chat history:', e.message);
    }
  }
}

checkActiveDogsAndMessages().catch(console.error);

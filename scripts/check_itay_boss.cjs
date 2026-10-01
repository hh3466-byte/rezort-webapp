const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[m[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const greenApiId = '710722735421';
const greenApiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function inspectBossItay() {
  console.log('=== 1. BOOKINGS FOR BOSS / ITAY ===');
  const { data: bookings } = await supabase.from('bookings').select('*');
  const bMatches = (bookings || []).filter(b => 
    JSON.stringify(b).includes('בוס') || 
    JSON.stringify(b).includes('אהרונסון') || 
    JSON.stringify(b).includes('3044647') ||
    JSON.stringify(b).includes('איתי')
  );
  console.log('Bookings:', JSON.stringify(bMatches, null, 2));

  console.log('\n=== 2. SEARCHING FOR 2000 / 4500 / 6500 GROW PAYMENTS ===');
  // Check settings
  const { data: settings } = await supabase.from('resort_settings').select('*');
  if (settings && settings[0]) {
    const s = settings[0].data || {};
    const growPayments = s.growPayments || s.pendingGrowPayments || [];
    console.log('Settings Grow Payments:', growPayments.filter(p => 
      JSON.stringify(p).includes('2000') || 
      JSON.stringify(p).includes('4500') || 
      JSON.stringify(p).includes('6500') ||
      JSON.stringify(p).includes('אהרונסון') ||
      JSON.stringify(p).includes('3044647')
    ));
  }

  console.log('\n=== 3. CHAT HISTORY WITH ITAY (054-3044647) ===');
  try {
    const url = `https://api.green-api.com/waInstance${greenApiId}/getChatHistory/${greenApiToken}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972543044647@c.us', count: 50 })
    });
    const msgs = await resp.json();
    console.log('Total msgs in chat:', Array.isArray(msgs) ? msgs.length : msgs);
    if (Array.isArray(msgs)) {
      msgs.reverse().forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || m.caption || m.typeMessage || '';
        const d = new Date(m.timestamp * 1000).toLocaleString('he-IL');
        const sender = m.type === 'outgoing' ? 'Resort' : 'Itay';
        console.log(`[${d}] ${sender}: ${text}`);
      });
    }
  } catch (e) {
    console.error('Error fetching chat:', e);
  }
}

inspectBossItay();

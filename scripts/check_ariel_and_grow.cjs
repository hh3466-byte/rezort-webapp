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

async function checkArielAndGrow() {
  console.log('=== 1. CHAT HISTORY WITH ARIEL SHRAIBER (054-4452521) ===');
  try {
    const url = `https://api.green-api.com/waInstance${greenApiId}/getChatHistory/${greenApiToken}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972544452521@c.us', count: 50 })
    });
    const msgs = await resp.json();
    console.log('Total msgs in Ariel chat:', Array.isArray(msgs) ? msgs.length : msgs);
    if (Array.isArray(msgs)) {
      msgs.reverse().forEach(m => {
        const text = m.textMessage || m.extendedTextMessage?.text || m.caption || m.typeMessage || '';
        const d = new Date(m.timestamp * 1000).toLocaleString('he-IL');
        const sender = m.type === 'outgoing' ? 'Resort' : 'Ariel';
        console.log(`[${d}] ${sender}: ${text}`);
      });
    }
  } catch (e) {
    console.error('Error fetching chat:', e);
  }

  console.log('\n=== 2. SEARCHING ALL GROW TRANSACTIONS IN CODEBASE ===');
  // Check VERIFIED_GROW_LEDGER in dailySanity1830Service.ts or anywhere in src
  const deepFiles = ['src/services/dailySanity1830Service.ts', 'src/services/paymentService.ts', 'src/components/GrowPaymentsModal.tsx'];
  for (const f of deepFiles) {
    try {
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes('4500') || l.includes('4,500') || l.includes('2000') || l.includes('2,000') || l.includes('6500') || l.includes('6,500') || l.includes('אהרונסון') || l.includes('שרייבר') || l.includes('בוס')) {
          console.log(`[${f}:${idx+1}] ${l.trim().slice(0, 120)}`);
        }
      });
    } catch(e) {}
  }
}

checkArielAndGrow();

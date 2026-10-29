const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:/Projects/הריזורט לכלב/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function recordHilaAdvance() {
  const { data: sRows, error: fErr } = await supabase.from('settings').select('*');
  if (fErr || !sRows?.length) {
    console.error('Fetch error:', fErr);
    return;
  }

  const s = sRows[0];
  const sData = s.data || {};
  const advances = sData.trainerAdvances || [];

  const newAdvance = {
    id: 'adv-hila-181026-3500',
    date: '2026-10-18',
    timestamp: '2026-10-18T11:18:00+03:00',
    amount: 3500,
    referenceNumber: '4882-6455-6',
    fromAccount: 'מגדל דנילוב בע"מ (622-651552 בנק הפועלים)',
    toRecipient: 'לקירזנר הילה (473-22575 בנק הפועלים בע"מ)',
    reason: 'מקדמות',
    purposeNotes: 'תשלום מקדמות עקב קשיים בתזרים. לקיזוז מול קבלות עתידיות של תיאו, לונה, בוס, ליאו או כלבים חדשים.',
    balanceRemaining: 3500,
    status: 'active'
  };

  // Avoid duplicates
  const exists = advances.some(a => a.referenceNumber === '4882-6455-6');
  if (!exists) {
    advances.push(newAdvance);
  }

  const updatedData = {
    ...sData,
    trainerAdvances: advances
  };

  const { error: upErr } = await supabase.from('settings').update({
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', s.id);

  if (upErr) {
    console.error('Update error:', upErr);
  } else {
    console.log('Successfully recorded Hila advance of ₪3,500 in Supabase settings!');
  }
}

recordHilaAdvance().catch(console.error);

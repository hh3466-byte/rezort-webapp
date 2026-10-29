const fs = require('fs');
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

async function markPassSent() {
  const { data: sData } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const settingsObj = sData?.data || {};
  const pList = settingsObj.daycare_passes || [];
  const updated = pList.map(p => {
    if (p.passCode === '3609' || p.id === 'pass-1792741316348') {
      return { ...p, status: 'sent', updatedAt: new Date().toISOString() };
    }
    return p;
  });
  await supabase.from('settings').upsert({ id: 'resort_config', data: { ...settingsObj, daycare_passes: updated } });
  console.log('Marked pass 3609 as sent in settings!');
}

markPassSent();

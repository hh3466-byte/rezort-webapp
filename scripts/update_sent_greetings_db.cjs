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

async function main() {
  const todayStr = '2026-09-23';
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const s = sRows?.[0] || {};
  const data = s.data || {};

  data.eveningGreetingsSentDate = todayStr;
  data.lastTomorrowOverviewSentDate = todayStr;
  data.lastTomorrowOverviewSentTimestamp = new Date().toISOString();

  const { error } = await supabase.from('settings').update({
    data,
    updated_at: new Date().toISOString()
  }).eq('id', s.id || 'resort_config');

  console.log('Updated settings with eveningGreetingsSentDate:', todayStr, 'Error:', error);
}

main().catch(console.error);

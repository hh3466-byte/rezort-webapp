const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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

async function run() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings[0];
  console.log('Keys in settings:', Object.keys(s));
  if (s.data) {
    console.log('Keys in settings.data:', Object.keys(s.data));
    for (const [k, v] of Object.entries(s.data)) {
      const str = JSON.stringify(v);
      if (str && (str.includes('ניבה') || str.includes('פורן') || str.includes('שטוץ') || str.includes('7900781'))) {
        console.log(`Matched in settings.data.${k}:`);
        console.log(str.slice(0, 1000));
      }
    }
  }
}

run();

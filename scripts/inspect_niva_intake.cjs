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
  console.log('=== INTAKE FORMS MATCHING NIVA ===');
  if (s.intake_forms) {
    const nivaForms = s.intake_forms.filter(f => 
      JSON.stringify(f).includes('ניבה') || 
      JSON.stringify(f).includes('פורן') || 
      JSON.stringify(f).includes('7900781') ||
      JSON.stringify(f).includes('שטוץ')
    );
    console.log(JSON.stringify(nivaForms, null, 2));
  }

  console.log('=== GROW SETTINGS ===');
  console.log({
    grow_api_key: s.grow_api_key ? 'EXISTS' : 'NONE',
    grow_user_id: s.grow_user_id,
    extra_data_grow: s.extra_data?.grow
  });

  // Check all grow payments today
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*').order('created_at', { ascending: false }).limit(20);
  console.log('Recent Grow payments:', growPayments);
}

run();

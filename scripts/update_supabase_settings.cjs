const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function updateSettings() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  if (error || !data || data.length === 0) {
    console.error('Error fetching settings:', error);
    return;
  }
  const s = data[0];
  const extra = s.extra_data || {};
  extra.greenApiIdInstance = '710722735421';
  extra.greenApiToken = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  extra.growPaymentLink = extra.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

  const { error: upErr } = await supabase
    .from('settings')
    .update({ extra_data: extra })
    .eq('id', s.id);

  if (upErr) {
    console.error('Failed to update settings:', upErr);
  } else {
    console.log('✓ Successfully updated Supabase settings with Green-API credentials and Grow link!');
  }
}

updateSettings();

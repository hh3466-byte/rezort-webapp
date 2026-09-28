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

async function saveGroupSettings() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  if (error || !data || data.length === 0) {
    console.error('Error fetching settings:', error);
    return;
  }

  const row = data[0];
  const currentData = row.data || {};
  
  const updatedData = {
    ...currentData,
    resort_community_chat_id: '120363412850948636@g.us',
    resort_community_invite_link: 'https://chat.whatsapp.com/FhBFW5Jltwa15g2OdDsWRb',
    resort_community_name: 'הריזורט לכלב',
    resort_community_manager_phone: '0543180407',
    resort_community_manager_name: 'רז'
  };

  const { error: updateError } = await supabase
    .from('settings')
    .update({ data: updatedData })
    .eq('id', row.id);

  if (updateError) {
    console.error('Error updating settings in Supabase:', updateError);
  } else {
    console.log('✓ Successfully saved resort community settings to Supabase!');
  }
}

saveGroupSettings();

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

async function inspectShalev() {
  console.log('=== SEARCHING CHAT FOR 0502845556 ===');
  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .or('chat_id.ilike.%502845556%,chat_id.ilike.%50-2845556%,sender_phone.ilike.%502845556%')
    .order('timestamp', { ascending: true });
  
  console.log(`Found ${messages?.length || 0} messages in whatsapp_messages:`);
  if (messages && messages.length > 0) {
    messages.forEach(m => console.log(`[${m.timestamp}] ${m.sender_name || m.chat_id}: ${m.message_text || m.text || m.content || JSON.stringify(m)}`));
  }

  console.log('\n=== SEARCHING GREEN API / CHAT LOGS ===');
  const { data: crm } = await supabase.from('crm_conversations').select('*');
  const sc = (crm || []).filter(c => JSON.stringify(c).includes('2845556') || JSON.stringify(c).includes('שליו') || JSON.stringify(c).includes('סקובי'));
  console.log('CRM convs:', JSON.stringify(sc, null, 2));

  console.log('\n=== SEARCHING ALL GROW TRANSACTIONS ===');
  const { data: grow } = await supabase.from('grow_transactions').select('*');
  const sg = (grow || []).filter(g => JSON.stringify(g).includes('2845556') || JSON.stringify(g).includes('שליו') || JSON.stringify(g).includes('1960'));
  console.log('Grow transactions:', JSON.stringify(sg, null, 2));
}

inspectShalev();

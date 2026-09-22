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

async function run() {
  const phones = ['0545443222', '0526113780', '0506363114', '0528787315', '0527777787'];
  for (const p of phones) {
    const p7 = p.slice(-7);
    const { data: convs } = await supabase.from('whatsapp_conversations').select('*').ilike('phone', '%' + p7 + '%');
    console.log('\n=========================================');
    console.log('=== CONVERSATION FOR ' + p + ' ===');
    console.log('=========================================');
    if (convs && convs.length > 0) {
      convs.forEach(c => {
        console.log('Contact:', c.contact_name, c.phone);
        const msgs = Array.isArray(c.messages) ? c.messages : (c.data?.messages || []);
        console.log(`Total messages: ${msgs.length}`);
        msgs.slice(-8).forEach(m => {
          const sender = m.sender || m.from || (m.fromMe ? 'Shmulik/Me' : 'Customer');
          const txt = m.text || m.body || m.message || '';
          console.log(`[${m.timestamp || m.time || ''}] ${sender}: ${txt.substring(0, 150)}`);
        });
      });
    } else {
      console.log('No conversation found in DB for ' + p);
    }
  }
}

run();

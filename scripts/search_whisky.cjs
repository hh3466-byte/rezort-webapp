const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let env = {};
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim();
  });
} catch(e) {}

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function searchTables() {
  console.log('--- 1. Check intake_requests table ---');
  try {
    const { data: intakes, error: inErr } = await supabase.from('intake_requests').select('*');
    if (inErr) {
      console.log('intake_requests error:', inErr);
    } else {
      console.log('Total intake_requests:', intakes ? intakes.length : 0);
      if (intakes) {
        intakes.forEach(i => {
          console.log(`Intake ID: ${i.id}, Dog: ${i.dog_name || i.dogName}, Owner: ${i.owner_name || i.ownerName}, Phone: ${i.owner_phone || i.ownerPhone}, Status: ${i.status}`);
        });
        const matches = intakes.filter(i => {
          const str = JSON.stringify(i);
          return str.includes('ויסקי') || str.includes('וויסקי') || str.toLowerCase().includes('whisky') || str.toLowerCase().includes('whiskey');
        });
        console.log('Intake matches for Whisky:', JSON.stringify(matches, null, 2));
      }
    }
  } catch(e) { console.log('intake err:', e); }

  console.log('--- 2. Check settings table ---');
  try {
    const { data: settings, error: sErr } = await supabase.from('settings').select('*');
    if (settings) {
      console.log('Settings rows count:', settings.length);
      settings.forEach(s => {
        console.log(`Setting ID: ${s.id}`);
        const str = JSON.stringify(s);
        if (str.includes('ויסקי') || str.includes('וויסקי') || str.toLowerCase().includes('whisky') || str.toLowerCase().includes('whiskey')) {
          console.log('FOUND in settings:', s.id);
        }
      });
    }
  } catch(e) { console.log('settings err:', e); }

  console.log('--- 3. Check whatsapp_messages ---');
  try {
    const { data: msgs, error: mErr } = await supabase.from('whatsapp_messages').select('*');
    if (msgs) {
      console.log('Total whatsapp_messages:', msgs.length);
      const matches = msgs.filter(m => {
        const str = JSON.stringify(m);
        return str.includes('ויסקי') || str.includes('וויסקי') || str.toLowerCase().includes('whisky') || str.toLowerCase().includes('whiskey');
      });
      console.log('WhatsApp msg matches:', matches.length);
      matches.forEach(m => console.log(JSON.stringify(m, null, 2)));
    } else if (mErr) {
      console.log('whatsapp_messages error:', mErr);
    }
  } catch(e) { console.log('msgs err:', e); }

  console.log('--- 4. Check whatsapp_chats ---');
  try {
    const { data: chats, error: chErr } = await supabase.from('whatsapp_chats').select('*');
    if (chats) {
      console.log('Total whatsapp_chats:', chats.length);
      const matches = chats.filter(c => {
        const str = JSON.stringify(c);
        return str.includes('ויסקי') || str.includes('וויסקי') || str.toLowerCase().includes('whisky') || str.toLowerCase().includes('whiskey');
      });
      console.log('WhatsApp chat matches:', matches.length);
      matches.forEach(c => console.log(JSON.stringify(c, null, 2)));
    } else if (chErr) {
      console.log('whatsapp_chats error:', chErr);
    }
  } catch(e) { console.log('chats err:', e); }

  console.log('--- 5. Check grow_incoming_payments ---');
  try {
    const { data: grows, error: gErr } = await supabase.from('grow_incoming_payments').select('*');
    if (grows) {
      const matches = grows.filter(g => {
        const str = JSON.stringify(g);
        return str.includes('ויסקי') || str.includes('וויסקי') || str.toLowerCase().includes('whisky') || str.toLowerCase().includes('whiskey');
      });
      console.log('Grow payment matches:', matches.length);
      matches.forEach(g => console.log(JSON.stringify(g, null, 2)));
    }
  } catch(e) { console.log('grow err:', e); }
}

searchTables();

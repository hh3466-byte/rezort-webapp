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

async function checkKira() {
  const { data: b } = await supabase.from('bookings').select('*').ilike('dog_name', '%קירה%');
  console.log('Kira booking:', b);
  if (b && b.length > 0) {
    await supabase.from('bookings').update({
      stay_status: 'checked_out',
      data: { ...(b[0].data || {}), stayStatus: 'checked_out' }
    }).eq('id', b[0].id);
    console.log('Kira successfully marked as checked_out!');
  }
}
checkKira();

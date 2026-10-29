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

async function main() {
  const { data: b } = await supabase.from('bookings').select('*').eq('id', 'b-1791895754861').single();
  if (b) {
    const newNotes = `${b.notes || ''} [אסמכתא Grow: grow_spindel_131026]`;
    const curData = { ...(b.data || {}), notes: newNotes };
    await supabase.from('bookings').update({
      notes: newNotes,
      data: curData,
      updated_at: new Date().toISOString()
    }).eq('id', b.id);
    console.log('Updated Phoebe notes with explicit Grow reference grow_spindel_131026');
  }
}

main();

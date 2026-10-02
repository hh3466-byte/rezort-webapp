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

async function cleanDuplicateJingas() {
  const { data: list } = await supabase.from('bookings').select('*');
  const jingasList = (list || []).filter(b => {
    const d = b.data || {};
    const name = (b.dog_name || d.dogName || '').trim();
    return name.includes('ג\'ינג') || name.includes('גינג');
  });

  console.log(`Found ${jingasList.length} records for Jingas:`);
  jingasList.forEach(j => console.log('ID:', j.id, 'Dog:', j.dog_name, 'Owner:', j.owner_name));

  if (jingasList.length > 1) {
    // Keep 'b-jingas-1790443885286', delete any other duplicate
    const toDelete = jingasList.filter(j => j.id !== 'b-jingas-1790443885286');
    for (const d of toDelete) {
      console.log('Deleting duplicate record:', d.id);
      await supabase.from('bookings').delete().eq('id', d.id);
    }
    console.log('Duplicate cleaned!');
  }
}

cleanDuplicateJingas().catch(console.error);

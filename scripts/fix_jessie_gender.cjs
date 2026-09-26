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

async function main() {
  const { data: b } = await supabase.from('bookings').select('*').eq('id', 'b-1788697331109').single();
  if (b) {
    const data = b.data || {};
    data.dogGender = 'female_spayed';
    const { error } = await supabase.from('bookings').update({
      dog_gender: 'female_spayed',
      data: data,
      updated_at: new Date().toISOString()
    }).eq('id', 'b-1788697331109');
    console.log('Updated Jessie dog_gender to female_spayed. Error:', error);
  }
}

main().catch(console.error);

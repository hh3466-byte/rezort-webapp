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

async function checkDetails() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  console.log('--- Current Settings trainerReceipts ---');
  console.log(JSON.stringify(s.trainerReceipts, null, 2));

  const { data: stays } = await supabase.from('stays').select('*');
  console.log('\n--- Training Dogs in Stays ---');
  const trainingStays = (stays || []).filter(st => {
    const d = st.data || {};
    return d.serviceType === 'training' || d.service === 'training' || d.serviceType === 'אילוף' || (d.notes && d.notes.includes('אילוף'));
  });
  trainingStays.forEach(st => {
    const d = st.data || {};
    console.log(`ID: ${st.id} Dog: ${d.dogName} Owner: ${d.ownerName} Dates: ${d.startDate} - ${d.endDate} Status: ${d.status} trainerPayments:`, d.trainerPayments);
  });
}

checkDetails().catch(console.error);

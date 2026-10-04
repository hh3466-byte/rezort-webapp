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
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log('=== All Bookings with training or mentioned in receipts ===');
  bookings.forEach(b => {
    const d = b.data || {};
    const isTr = b.service_type === 'training' || b.service_type === 'day_training' || (d && (d.serviceType === 'training' || d.serviceType === 'day_training')) || (b.notes && b.notes.includes('אילוף')) || ['לוסי', 'גולדי', 'ג\'וי', 'גוי', 'לונה', 'תיאו', 'בוס'].includes(b.dog_name);
    if (isTr) {
      console.log(JSON.stringify({
        id: b.id,
        dog_name: b.dog_name,
        owner_name: b.owner_name,
        service_type: b.service_type,
        start_date: b.start_date,
        end_date: b.end_date,
        stay_status: b.stay_status,
        trainerPaid: d.trainerPaid,
        trainerDebt: d.trainerDebt,
        isTrainingCompleted: d.isTrainingCompleted,
        trainerStages: d.trainerStages
      }, null, 2));
    }
  });
}

run().catch(console.error);

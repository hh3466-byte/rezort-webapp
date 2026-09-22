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

async function run() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }
  console.log('Total bookings in supabase:', bookings?.length);
  const training = (bookings || []).filter(b => 
    b.service_type === 'training' || 
    b.service_type === 'day_training' || 
    (b.notes || '').includes('אילוף')
  );
  console.log('Training bookings count:', training.length);
  training.forEach(b => console.log('Training Dog:', b.dog_name, 'Owner:', b.owner_name, 'Service:', b.service_type, 'Dates:', b.start_date, 'to', b.end_date));

  const allNames = (bookings || []).map(b => b.dog_name).filter(Boolean);
  console.log('Sample dog names:', allNames.slice(0, 30));
  
  // Look for joy / tian / theo
  const targets = (bookings || []).filter(b => {
    const name = b.dog_name || '';
    return name.includes('גוי') || name.includes('ג\'וי') || name.includes('תיא') || name.includes('ג׳וי');
  });
  console.log('Targets found:', targets.length);
  targets.forEach(b => console.log('Target dog:', b.dog_name, 'Owner:', b.owner_name, 'Service:', b.service_type, 'Status:', b.stay_status));
}

run();

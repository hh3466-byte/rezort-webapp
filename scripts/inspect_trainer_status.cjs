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
  const { data: settings, error } = await supabase.from('settings').select('*');
  console.log('--- Settings ---', { count: settings?.length, error });
  if (settings && settings.length > 0) {
    const s = settings[0];
    console.log('keys in settings[0]:', Object.keys(s));
    console.log('data field keys:', Object.keys(s.data || {}));
    if (s.data?.trainerReceipts) {
      console.log('trainerReceipts in settings:', JSON.stringify(s.data.trainerReceipts, null, 2));
    }
  }



  const { data: bookings } = await supabase.from('bookings').select('*');
  const trainingBookings = (bookings || []).filter(b => 
    b.service_type === 'training' || 
    b.service_type === 'day_training' || 
    (b.notes || '').includes('אילוף')
  );
  console.log('--- Training Bookings in Supabase ---');
  trainingBookings.forEach(b => {
    console.log({
      id: b.id,
      dog_name: b.dog_name,
      owner_name: b.owner_name,
      service_type: b.service_type,
      stay_status: b.stay_status,
      start_date: b.start_date,
      end_date: b.end_date,
      trainer_stages: b.trainer_stages || b.trainerStages || (b.data && b.data.trainerStages),
      is_training_completed: b.is_training_completed || b.isTrainingCompleted || (b.data && b.data.isTrainingCompleted)
    });
  });
}

run();

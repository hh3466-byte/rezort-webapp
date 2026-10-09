const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) { console.error(error); return; }
  console.log('Total bookings in DB:', bookings.length);
  
  const names = ['רונן מלמוד', 'הדס שקל', 'דליה מוסקוביץ', 'ירוס ביקאיה', 'דוד אלקחר', 'זיו זיסו', 'אור נברי', 'ישראל מנדל', 'קארין להב', 'יניב אלעד', 'שליו ביטון', 'אייל ברקוביץ'];
  
  const matched = bookings.filter(b => {
    const o = b.owner_name || '';
    return names.some(n => o.includes(n));
  });
  
  console.log('Matched bookings count:', matched.length);
  matched.forEach(b => {
    console.log(JSON.stringify({
      id: b.id,
      dog: b.dog_name,
      owner: b.owner_name,
      phone: b.owner_phone,
      start: b.start_date,
      end: b.end_date,
      status: b.stay_status,
      price: b.total_price,
      deposit: b.deposit_amount,
      payment_status: b.payment_status,
      free: b.is_free_stay,
      service: b.service_type,
      notes: b.notes
    }, null, 2));
  });
}
check();

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
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error(error);
    return;
  }

  bookings.forEach((b, i) => {
    const d = b.data || {};
    console.log(JSON.stringify({
      num: i + 1,
      id: b.id,
      created: b.created_at,
      dog: b.dog_name || d.dogName,
      breed: b.dog_breed || d.dogBreed,
      gender: b.dog_gender || d.dogGender,
      owner: b.owner_name || d.ownerName,
      phone: b.owner_phone || d.ownerPhone,
      email: b.owner_email || d.ownerEmail,
      dates: `${b.start_date || d.startDate} to ${b.end_date || d.endDate}`,
      total: b.total_price || d.totalPrice,
      deposit: b.deposit_amount || d.depositAmount,
      emergency: b.emergency_contact || d.emergencyContact,
      notes: b.notes || d.notes
    }, null, 2));
  });
}

run();

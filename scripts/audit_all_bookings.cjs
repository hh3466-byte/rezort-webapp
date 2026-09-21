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
  const { data: settingsRow } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');
  const { data: customers } = await supabase.from('customers').select('*');

  const intakeRequests = settingsRow?.data?.intakeRequests || [];

  console.log(`Total bookings: ${bookings.length}`);
  console.log(`Total intakeRequests: ${intakeRequests.length}`);
  console.log(`Total growPayments: ${growPayments.length}`);
  console.log(`Total customers: ${customers.length}`);

  const missingEmail = [];
  const missingPhone = [];
  const missingBreed = [];
  const missingEmergency = [];

  bookings.forEach(b => {
    const d = b.data || {};
    const email = b.owner_email || d.ownerEmail;
    const phone = b.owner_phone || d.ownerPhone;
    const breed = b.dog_breed || d.dogBreed;
    const emergency = b.emergency_contact || d.emergencyContact;

    if (!email) missingEmail.push({ id: b.id, dog: b.dog_name || d.dogName, owner: b.owner_name || d.ownerName, phone });
    if (!phone) missingPhone.push({ id: b.id, dog: b.dog_name || d.dogName, owner: b.owner_name || d.ownerName });
    if (!breed || breed === 'מעורב' || breed === 'NONE') missingBreed.push({ id: b.id, dog: b.dog_name || d.dogName, breed });
    if (!emergency) missingEmergency.push({ id: b.id, dog: b.dog_name || d.dogName, owner: b.owner_name || d.ownerName });
  });

  console.log(`\n--- Bookings Missing Email (${missingEmail.length}): ---`);
  missingEmail.forEach(m => console.log(`[${m.id}] Dog: ${m.dog} | Owner: ${m.owner} | Phone: ${m.phone}`));

  console.log(`\n--- Bookings Missing Phone (${missingPhone.length}): ---`);
  missingPhone.forEach(m => console.log(`[${m.id}] Dog: ${m.dog} | Owner: ${m.owner}`));
}

run();

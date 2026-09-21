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

function cleanPhone(p) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.startsWith('972') && d.length >= 12) return '0' + d.slice(3);
  return d;
}

async function run() {
  const { data: bData } = await supabase.from('bookings').select('*');
  const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  const intakeRequests = sData?.data?.intakeRequests || [];

  console.log(`Checking ${intakeRequests.length} intake requests against ${bData.length} bookings...`);

  const shouldBeClosed = [];

  intakeRequests.forEach(req => {
    const rPhone = cleanPhone(req.ownerPhone);
    const rDog = (req.dogName || '').trim();

    // Check if there is an active booking
    const matched = bData.find(b => {
      const d = b.data || {};
      const bPhone = cleanPhone(b.owner_phone || d.ownerPhone);
      const bDog = (b.dog_name || d.dogName || '').trim();
      const phoneMatch = bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7));
      const dogMatch = bDog && rDog && (bDog === rDog || bDog.includes(rDog) || rDog.includes(bDog));
      return phoneMatch || (dogMatch && req.ownerName && (b.owner_name || d.ownerName || '').includes(req.ownerName));
    });

    if (matched) {
      const d = matched.data || {};
      console.log(`Intake [${req.status}] Dog:${req.dogName} Owner:${req.ownerName} Phone:${req.ownerPhone} -> MATCHED Booking [${matched.id}] ${matched.dog_name || d.dogName} (${matched.start_date || d.startDate})`);
      if (req.status === 'pending' || req.status === 'payment_requested') {
        shouldBeClosed.push({ intakeId: req.id, dog: req.dogName, owner: req.ownerName, status: req.status, bookingId: matched.id });
      }
    }
  });

  console.log(`\nFound ${shouldBeClosed.length} intake requests that have bookings but are STILL ${shouldBeClosed.map(s => s.status).join(',')}:`);
  shouldBeClosed.forEach(s => console.log(` - ${s.dog} (${s.owner}) currently '${s.status}', matched booking ${s.bookingId}`));
}

run();

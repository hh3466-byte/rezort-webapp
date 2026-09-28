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

function cleanPhone(phone) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 9) return '972' + digits;
  return null;
}

async function countClients() {
  const { data: bookings, error } = await supabase.from('bookings').select('owner_name, owner_phone, dog_name, stay_status, end_date');
  if (error) {
    console.error(error);
    return;
  }

  const clientsMap = new Map();
  bookings.forEach(b => {
    const rawPhone = b.owner_phone || b.ownerPhone;
    const clean = cleanPhone(rawPhone);
    if (clean && !clean.includes('0506336896') && !clean.includes('0543200007') && !clean.includes('0543180407')) {
      if (!clientsMap.has(clean)) {
        clientsMap.set(clean, {
          name: b.owner_name || 'לקוח',
          dog: b.dog_name || 'כלב',
          phone: clean,
          lastEndDate: b.end_date
        });
      }
    }
  });

  console.log(`Total unique clients with valid phones: ${clientsMap.size}`);
  const list = Array.from(clientsMap.values());
  console.log('Sample of clients:', list.slice(0, 10));
}

countClients();

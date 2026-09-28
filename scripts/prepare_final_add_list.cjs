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

async function prepareFinalAddList() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error(error);
    return;
  }

  const clientsMap = new Map();
  const excludedMap = new Map();

  const internalPhones = ['0506336896', '0543200007', '0543180407', '972548765888', '0548765888'];
  const blacklistPhones = ['972545443222', '0545443222']; // יניב אלעד (כלב ברח)

  bookings.forEach(b => {
    const rawPhone = b.owner_phone || b.ownerPhone;
    const clean = cleanPhone(rawPhone);
    const ownerName = (b.owner_name || b.ownerName || 'לקוח').trim();
    const dogName = (b.dog_name || b.dogName || 'כלב').trim();
    const notes = b.notes || '';

    if (!clean) return;

    // Check internal
    if (internalPhones.some(p => clean.includes(p.replace(/\D/g, '')))) {
      return;
    }

    // Check escaped dog or Matana
    const isEscaped = blacklistPhones.includes(clean) || notes.includes('ברח') || clean === '972545443222';
    const isMatana = ownerName.includes('מתנה') || notes.includes('מתנה');

    if (isEscaped || isMatana) {
      excludedMap.set(clean, {
        name: ownerName,
        dog: dogName,
        phone: clean,
        reason: isEscaped ? 'הכלב ברח (יניב אלעד)' : 'משפחת מתנה (תביעה)'
      });
      return;
    }

    // Include all others (including Gal Sarah Shemesh and Tom Danino)
    if (!clientsMap.has(clean)) {
      clientsMap.set(clean, {
        name: ownerName,
        dog: dogName,
        phone: clean,
        chatId: `${clean}@c.us`
      });
    }
  });

  // Remove any excluded from clientsMap
  for (const p of excludedMap.keys()) {
    clientsMap.delete(p);
  }

  console.log(`\n=========================================`);
  console.log(`📋 רשימת לקוחות סופית לצירוף לקבוצה: ${clientsMap.size}`);
  console.log(`🚫 לקוחות שהוחרגו סופית: ${excludedMap.size}`);
  console.log(`=========================================`);

  console.log('\nפירוט מוחרגים:');
  excludedMap.forEach(c => console.log(`❌ ${c.name} (${c.dog}, ${c.phone}): ${c.reason}`));

  console.log('\nרשימת כל 50 הלקוחות שיצורפו:');
  let idx = 1;
  clientsMap.forEach(c => {
    console.log(`${idx++}. ${c.name} | ${c.dog} | ${c.phone}`);
  });
}

prepareFinalAddList();

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

async function getFilteredClients() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error(error);
    return;
  }

  const eligibleClients = new Map();
  const excludedClients = [];

  bookings.forEach(b => {
    const rawPhone = b.owner_phone || b.ownerPhone;
    const clean = cleanPhone(rawPhone);
    const ownerName = b.owner_name || b.ownerName || 'לקוח';
    const dogName = b.dog_name || b.dogName || 'כלב';
    const notes = b.notes || '';
    const isCancelled = (b.stay_status || b.stayStatus) === 'cancelled';
    const isSkipReview = b.skip_review_request === true || 
                         b.skipReviewRequest === true || 
                         notes.includes('ללא_סקר') || 
                         notes.includes('[ללא_סקר]');

    if (!clean) return;
    if (clean.includes('0506336896') || clean.includes('0543200007') || clean.includes('0543180407') || clean.includes('972548765888')) {
      return; // Internal staff
    }

    if (isSkipReview || isCancelled) {
      excludedClients.push({
        name: ownerName,
        dog: dogName,
        phone: clean,
        reason: isCancelled ? 'הזמנה בוטלה' : 'סומן ללא סקר / לא הסתדר'
      });
      // If client has another booking that was excluded, make sure they don't get added unless they have an active good booking?
      // Actually if ANY booking marked as skip_review / did not get along, they should be excluded from community.
    } else {
      if (!eligibleClients.has(clean)) {
        eligibleClients.set(clean, {
          name: ownerName,
          dog: dogName,
          phone: clean
        });
      }
    }
  });

  // Remove any client from eligible if they are in excluded
  const excludedPhones = new Set(excludedClients.map(c => c.phone));
  for (const phone of excludedPhones) {
    eligibleClients.delete(phone);
  }

  console.log(`\n--- תוצאות סינון לקוחות לקהילה ---`);
  console.log(`✓ לקוחות מאושרים לצירוף: ${eligibleClients.size}`);
  console.log(`❌ לקוחות שהוחרגו (ביטלו / סומנו ללא סקר): ${excludedPhones.size}`);
  
  if (excludedClients.length > 0) {
    console.log('\nפירוט מוחרגים:');
    excludedClients.forEach(c => console.log(`- ${c.name} (${c.dog}, ${c.phone}): ${c.reason}`));
  }

  console.log('\nמדגם לקוחות מאושרים:');
  Array.from(eligibleClients.values()).slice(0, 10).forEach(c => {
    console.log(`- ${c.name} (${c.dog}, ${c.phone})`);
  });
}

getFilteredClients();

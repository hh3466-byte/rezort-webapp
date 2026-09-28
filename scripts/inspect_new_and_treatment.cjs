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

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

const normalizeHebrew = (str = '') => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[״"׳']/g, '')
    .replace(/ו{2,}/g, 'ו')
    .replace(/י{2,}/g, 'י');
};

const hasActiveBookingForIntake = (r, bookings = []) => {
  if (!bookings || bookings.length === 0) return false;
  const rPhone = cleanPhoneNumber(r.ownerPhone || r.owner_phone || '');
  const rDog = normalizeHebrew(r.dogName || r.dog_name || '');
  const rStart = r.startDate || r.start_date;
  const rEnd = r.endDate || r.end_date;

  return bookings.some(b => {
    if (b.stay_status === 'cancelled' || b.stayStatus === 'cancelled') return false;
    const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
    const bDog = normalizeHebrew(b.dog_name || b.dogName || '');
    
    const phoneMatch = Boolean(bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7)));
    if (!phoneMatch) return false;

    const dogMatch = !rDog || !bDog || bDog === rDog || bDog.includes(rDog) || rDog.includes(bDog);
    if (!dogMatch) return false;

    const bStart = b.start_date || b.startDate;
    const bEnd = b.end_date || b.endDate;
    if (rStart && rEnd && bStart && bEnd) {
      return bStart <= rEnd && bEnd >= rStart;
    }

    return false;
  });
};

const getEffectiveIntakeStatus = (r, bookings = []) => {
  if (r.status === 'approved') return 'approved';
  if (r.status === 'abandoned') return 'abandoned';
  if (r.status === 'archived') return 'archived';
  if (r.status === 'rejected') return 'rejected';
  if (hasActiveBookingForIntake(r, bookings)) return 'approved';
  return r.status;
};

const isIntakeRequestNew = (r, bookings = []) => {
  if (r.status === 'abandoned' || r.status === 'rejected' || r.status === 'archived') return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  const intNotes = r.internalNotes || r.internal_notes || '';
  return effStatus === 'pending' && (!intNotes || !intNotes.trim());
};

const isIntakeRequestInTreatment = (r, bookings = []) => {
  if (r.status === 'abandoned' || r.status === 'rejected' || r.status === 'archived') return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  const intNotes = r.internalNotes || r.internal_notes || '';
  return effStatus === 'payment_requested' || (effStatus === 'pending' && Boolean(intNotes && intNotes.trim()));
};

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: intakesRows } = await supabase.from('intake_requests').select('*');

  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };

  const rawFromSettings = (sRow && sRow.data && Array.isArray(sRow.data.intakeRequests)) ? sRow.data.intakeRequests : [];
  const intakeMap = new Map();
  [...rawFromSettings, ...(intakesRows || [])].forEach(item => {
    if (item && item.id) {
      intakeMap.set(item.id, item);
    }
  });
  const allIntakes = Array.from(intakeMap.values());

  console.log(`Total intakes: ${allIntakes.length}`);

  const newOnes = allIntakes.filter(r => isIntakeRequestNew(r, bookings));
  const inTreatmentOnes = allIntakes.filter(r => isIntakeRequestInTreatment(r, bookings));

  console.log(`\n=== isIntakeRequestNew (count = ${newOnes.length}) ===`);
  newOnes.forEach((r, i) => {
    console.log(`${i + 1}. [${r.status}] ${r.dogName || r.dog_name} (${r.ownerName || r.owner_name} - ${r.ownerPhone || r.owner_phone}) | ${r.startDate || r.start_date} to ${r.endDate || r.end_date} | internalNotes: "${r.internalNotes || r.internal_notes || ''}"`);
  });

  console.log(`\n=== isIntakeRequestInTreatment (count = ${inTreatmentOnes.length}) ===`);
  inTreatmentOnes.forEach((r, i) => {
    console.log(`${i + 1}. [${r.status}] ${r.dogName || r.dog_name} (${r.ownerName || r.owner_name} - ${r.ownerPhone || r.owner_phone}) | ${r.startDate || r.start_date} to ${r.endDate || r.end_date} | internalNotes: "${r.internalNotes || r.internal_notes || ''}"`);
  });
}

run();

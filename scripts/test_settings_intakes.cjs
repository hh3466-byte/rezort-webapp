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

function cleanPhoneNumber(p) {
  if (!p) return '';
  return String(p).replace(/\D/g, '');
}

function normalizeHebrew(str = '') {
  return str
    .toLowerCase()
    .trim()
    .replace(/[״"׳']/g, '')
    .replace(/ו{2,}/g, 'ו')
    .replace(/י{2,}/g, 'י');
}

function hasActiveBookingForIntake(r, bookings = []) {
  if (!bookings || bookings.length === 0) return false;
  const rPhone = cleanPhoneNumber(r.ownerPhone);
  const rDog = normalizeHebrew(r.dogName);

  return bookings.some(b => {
    const d = b.data || {};
    const stayStatus = b.stay_status || d.stayStatus;
    if (stayStatus === 'cancelled') return false;
    const bPhone = cleanPhoneNumber(b.owner_phone || d.ownerPhone);
    const bDog = normalizeHebrew(b.dog_name || d.dogName);
    const bOwner = normalizeHebrew(b.owner_name || d.ownerName);
    const rOwner = normalizeHebrew(r.ownerName);

    const phoneMatch = Boolean(bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7)));
    const dogMatch = Boolean(bDog && rDog && (bDog === rDog || bDog.includes(rDog) || rDog.includes(bDog)));
    return phoneMatch || (dogMatch && rOwner && bOwner.includes(rOwner));
  });
}

function getIntakeRequestAgeHours(r) {
  const created = new Date(r.createdAt || r.startDate).getTime();
  if (isNaN(created)) return 0;
  return (Date.now() - created) / (1000 * 60 * 60);
}

function getEffectiveIntakeStatus(r, bookings = []) {
  const status = r.status;
  if (status === 'approved') return 'approved';
  if (hasActiveBookingForIntake(r, bookings)) return 'approved';
  return status;
}

function isUnansweredIntakeRequest(r, bookings = []) {
  const status = r.status;
  if (status === 'approved' || hasActiveBookingForIntake(r, bookings)) return false;
  if (status === 'rejected') return false;
  const notes = r.internalNotes || '';
  const hasUnansweredNote = notes.includes('לא ענה') || notes.includes('תזכורת שיווקית');
  const isAgeOver24h = getIntakeRequestAgeHours(r) >= 24;
  return hasUnansweredNote || isAgeOver24h;
}

function isIntakeRequestNew(r, bookings = []) {
  if (isUnansweredIntakeRequest(r, bookings)) return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  const notes = r.internalNotes || '';
  return effStatus === 'pending' && (!notes || !notes.trim());
}

function isIntakeRequestInTreatment(r, bookings = []) {
  if (isUnansweredIntakeRequest(r, bookings)) return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  const notes = r.internalNotes || '';
  return effStatus === 'payment_requested' || (effStatus === 'pending' && Boolean(notes && notes.trim()));
}

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: sRow } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();

  const intakes = sRow?.data?.intakeRequests || [];
  console.log(`Bookings: ${bookings?.length}, Intakes in settings: ${intakes.length}`);

  let newCount = 0;
  let inTreatmentCount = 0;
  let rawInTreatmentCount = 0;
  let unansweredCount = 0;
  let approvedCount = 0;

  intakes.forEach(r => {
    const isNew = isIntakeRequestNew(r, bookings);
    const inTreat = isIntakeRequestInTreatment(r, bookings);
    const hasBooking = hasActiveBookingForIntake(r, bookings);
    const unans = isUnansweredIntakeRequest(r, bookings);
    const eff = getEffectiveIntakeStatus(r, bookings);
    const age = getIntakeRequestAgeHours(r);

    // Raw old formula (before our fix)
    const rawInTreat = r.status === 'payment_requested' || (r.status === 'pending' && Boolean(r.internalNotes && r.internalNotes.trim()));
    if (rawInTreat) rawInTreatmentCount++;

    if (isNew) newCount++;
    if (inTreat) inTreatmentCount++;
    if (unans) unansweredCount++;
    if (eff === 'approved') approvedCount++;

    console.log(`• [${r.id}] Dog: ${r.dogName} | Owner: ${r.ownerName} (${r.ownerPhone}) | Status: ${r.status} | Eff: ${eff} | HasBooking: ${hasBooking} | AgeH: ${age.toFixed(1)} | Notes: "${(r.internalNotes || '').slice(0, 40)}" | RawInTreat: ${rawInTreat} | NewInTreat: ${inTreat}`);
  });

  console.log('\n======================================');
  console.log('SUMMARY:');
  console.log('Total Intakes:', intakes.length);
  console.log('RAW OLD in-progress count (the "16"):', rawInTreatmentCount);
  console.log('NEW FILTERED in-progress count (without bookings / >24h):', inTreatmentCount);
  console.log('NEW Count (brand new unhandled):', newCount);
  console.log('Unanswered (>24h or note):', unansweredCount);
  console.log('Already has Booking in Calendar:', intakes.filter(r => hasActiveBookingForIntake(r, bookings)).length);
  console.log('======================================');
}

run();

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
  const rPhone = cleanPhoneNumber(r.ownerPhone || r.owner_phone);
  const rDog = normalizeHebrew(r.dogName || r.dog_name);

  return bookings.some(b => {
    const d = b.data || {};
    const stayStatus = b.stay_status || d.stayStatus;
    if (stayStatus === 'cancelled') return false;
    const bPhone = cleanPhoneNumber(b.owner_phone || d.ownerPhone);
    const bDog = normalizeHebrew(b.dog_name || d.dogName);
    const bOwner = normalizeHebrew(b.owner_name || d.ownerName);
    const rOwner = normalizeHebrew(r.ownerName || r.owner_name);

    const phoneMatch = Boolean(bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7)));
    const dogMatch = Boolean(bDog && rDog && (bDog === rDog || bDog.includes(rDog) || rDog.includes(bDog)));
    return phoneMatch || (dogMatch && rOwner && bOwner.includes(rOwner));
  });
}

function getIntakeRequestAgeHours(r) {
  const created = new Date(r.createdAt || r.created_at || r.startDate || r.start_date).getTime();
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
  const notes = r.internalNotes || r.internal_notes || '';
  const hasUnansweredNote = notes.includes('לא ענה') || notes.includes('תזכורת שיווקית');
  const isAgeOver24h = getIntakeRequestAgeHours(r) >= 24;
  return hasUnansweredNote || isAgeOver24h;
}

function isIntakeRequestNew(r, bookings = []) {
  if (isUnansweredIntakeRequest(r, bookings)) return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  const notes = r.internalNotes || r.internal_notes || '';
  return effStatus === 'pending' && (!notes || !notes.trim());
}

function isIntakeRequestInTreatment(r, bookings = []) {
  if (isUnansweredIntakeRequest(r, bookings)) return false;
  const effStatus = getEffectiveIntakeStatus(r, bookings);
  const notes = r.internalNotes || r.internal_notes || '';
  return effStatus === 'payment_requested' || (effStatus === 'pending' && Boolean(notes && notes.trim()));
}

async function run() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');

  console.log(`Bookings count: ${bookings?.length}`);
  console.log(`Intakes in Supabase count: ${intakes?.length}`);

  let newCount = 0;
  let inTreatmentCount = 0;
  let unansweredCount = 0;
  let approvedCount = 0;

  intakes.forEach(r => {
    const isNew = isIntakeRequestNew(r, bookings);
    const inTreat = isIntakeRequestInTreatment(r, bookings);
    const unans = isUnansweredIntakeRequest(r, bookings);
    const eff = getEffectiveIntakeStatus(r, bookings);
    const age = getIntakeRequestAgeHours(r);

    if (isNew) newCount++;
    if (inTreat) inTreatmentCount++;
    if (unans) unansweredCount++;
    if (eff === 'approved') approvedCount++;

    console.log(`- [${r.id}] Dog: ${r.dog_name} | Owner: ${r.owner_name} | Status: ${r.status} | Eff: ${eff} | AgeH: ${age.toFixed(1)} | New: ${isNew} | InTreat: ${inTreat} | Unans: ${unans}`);
  });

  console.log('\n--- SUMMARY ---');
  console.log('New Count:', newCount);
  console.log('In-Treatment Count:', inTreatmentCount);
  console.log('Unanswered (>24h):', unansweredCount);
  console.log('Approved / Active in Booking:', approvedCount);
}

run();

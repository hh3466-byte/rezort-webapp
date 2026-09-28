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

function getTodayIsraelStr() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dtf.format(now);
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

async function testCleanIntakes() {
  const todayStr = getTodayIsraelStr();
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

  const activeBookings = (bookings || []).filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

  // Filter truly actionable future unhandled intakes (excluding abandoned, archived, rejected, approved, and past/today check-ins without booking)
  const unhandledIntakes = allIntakes.filter(r => {
    const st = r.status;
    // Only pending, in_progress, payment_requested or new
    if (st !== 'pending' && st !== 'in_progress' && st !== 'payment_requested' && st !== 'new') return false;

    const rStart = r.startDate || r.start_date || '';
    const rEnd = r.endDate || r.end_date || '';

    // If start date is today or in the past, and no booking exists -> should be archived
    if (rStart <= todayStr || rEnd <= todayStr) return false;

    const rDog = (r.dogName || r.dog_name || '').trim().toLowerCase();
    const rPhone = cleanPhoneNumber(r.ownerPhone || r.owner_phone || '');
    const hasBooking = activeBookings.some(b => {
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      return (rDog && bDog && rDog === bDog && (bPhone.slice(-7) === rPhone.slice(-7) || !rPhone));
    });
    return !hasBooking;
  });

  // Approved intakes without calendar booking for future stays
  const approvedIntakesWithoutBooking = allIntakes.filter(ai => {
    if (ai.status !== 'approved') return false;
    const aiStart = ai.startDate || ai.start_date || '';
    const aiEnd = ai.endDate || ai.end_date || '';

    if (aiStart <= todayStr || aiEnd <= todayStr) return false;

    const aiDog = (ai.dogName || ai.dog_name || '').trim().toLowerCase();
    const aiPhone = cleanPhoneNumber(ai.ownerPhone || ai.owner_phone || '');
    return !activeBookings.some(b => {
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      const bStart = b.start_date || b.startDate;
      const bEnd = b.end_date || b.endDate;
      const sameDog = bDog === aiDog;
      const samePhone = (aiPhone && bPhone && aiPhone === bPhone);
      const sameDates = (aiStart && bStart === aiStart && aiEnd && bEnd === aiEnd);
      return (sameDog && samePhone) || (sameDog && sameDates);
    });
  });

  console.log(`\n=== Genuinely actionable upcoming unhandled intakes: ${unhandledIntakes.length} ===`);
  unhandledIntakes.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.status}] ${r.dogName || r.dog_name} (${r.ownerName || r.owner_name} - ${r.ownerPhone || r.owner_phone}) | ${r.startDate || r.start_date} to ${r.endDate || r.end_date}`);
  });

  console.log(`\n=== Genuinely upcoming approved intakes without booking: ${approvedIntakesWithoutBooking.length} ===`);
  approvedIntakesWithoutBooking.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.status}] ${r.dogName || r.dog_name} (${r.ownerName || r.owner_name} - ${r.ownerPhone || r.owner_phone}) | ${r.startDate || r.start_date} to ${r.endDate || r.end_date}`);
  });
}

testCleanIntakes();

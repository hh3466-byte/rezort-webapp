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

async function inspectIntakes() {
  const todayStr = getTodayIsraelStr();
  console.log('Today in Israel:', todayStr);

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

  console.log(`Total intakes across settings & table: ${allIntakes.length}`);

  const toArchive = [];
  const validUpcoming = [];

  allIntakes.forEach(r => {
    if (r.status === 'archived' || r.status === 'rejected') return;

    const rDog = (r.dogName || r.dog_name || '').trim().toLowerCase();
    const rPhone = cleanPhoneNumber(r.ownerPhone || r.owner_phone || '');
    const sDate = r.startDate || r.start_date || '';
    const eDate = r.endDate || r.end_date || '';

    const hasBooking = (bookings || []).some(b => {
      if (b.stay_status === 'cancelled' || b.stayStatus === 'cancelled') return false;
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      return (rDog && bDog && rDog === bDog && (bPhone.slice(-7) === rPhone.slice(-7) || !rPhone));
    });

    // Check if dates have passed:
    // If end date is in the past (< todayStr), or if start date is already in the past (< todayStr) and no booking was made
    const isPast = (eDate && eDate < todayStr) || (sDate && sDate < todayStr);

    if (!hasBooking && isPast) {
      toArchive.push({ ...r, reason: `Past dates (${sDate} to ${eDate}) without booking` });
    } else {
      validUpcoming.push({ ...r, hasBooking });
    }
  });

  console.log(`\nFound ${toArchive.length} past intake requests to auto-archive:`);
  toArchive.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.status}] ${r.dogName || r.dog_name} (${r.ownerName || r.owner_name} - ${r.ownerPhone || r.owner_phone}) | ${r.startDate || r.start_date} to ${r.endDate || r.end_date}`);
  });

  console.log(`\nRemaining active/upcoming intake requests: ${validUpcoming.length}`);
  validUpcoming.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.status}] ${r.dogName || r.dog_name} (${r.ownerName || r.owner_name}) | ${r.startDate || r.start_date} to ${r.endDate || r.end_date} (hasBooking: ${r.hasBooking})`);
  });
}

inspectIntakes();

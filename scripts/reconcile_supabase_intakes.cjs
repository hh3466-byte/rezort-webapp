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

async function run() {
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
  const { data: sRow, error: sErr } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();

  if (sErr || !sRow?.data) {
    console.error('Error fetching settings:', sErr);
    return;
  }

  const intakes = sRow.data.intakeRequests || [];
  console.log(`Loaded ${intakes.length} intake requests.`);

  let updatedCount = 0;
  const updatedIntakes = intakes.map(r => {
    if (r.status === 'approved' || r.status === 'rejected') return r;

    // 1. If dog already has an active booking in the calendar -> auto-approve in DB!
    if (hasActiveBookingForIntake(r, bookings)) {
      updatedCount++;
      console.log(`[Auto-Approved in DB] Dog: ${r.dogName} | Owner: ${r.ownerName} (Active booking found in calendar)`);
      return {
        ...r,
        status: 'approved',
        internalNotes: (r.internalNotes ? r.internalNotes + ' | ' : '') + '[נקלט בהצלחה ליומן הריזורט]'
      };
    }

    return r;
  });

  if (updatedCount > 0) {
    const updatedSettingsData = {
      ...sRow.data,
      intakeRequests: updatedIntakes
    };

    const { error: uErr } = await supabase
      .from('settings')
      .update({ data: updatedSettingsData })
      .eq('id', 'resort_config');

    if (uErr) {
      console.error('Error updating settings in Supabase:', uErr);
    } else {
      console.log(`Successfully updated ${updatedCount} intake requests to 'approved' in Supabase!`);
    }
  } else {
    console.log('No intake requests needed updating.');
  }
}

run();
